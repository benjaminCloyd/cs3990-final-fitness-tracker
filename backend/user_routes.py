from auth.authenticate import authenticate
from auth.hash_password import hash_password, verify_password
from auth.jwt_handler import TokenData, create_access_token
from database.connection import Database
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from models import SignupRequest, TokenResponse, User, UserResponse, UserUpdateRequest
from logger import log_event, get_recent_logs

user_router = APIRouter()
user_database = Database(User)


# ── helpers ───────────────────────────────────────────────────────────────────


def require_admin(user: TokenData):
    """Enforce admin-only access for specific endpoints."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )


def user_to_response(u: User) -> UserResponse:
    """Map a User document to a sanitized(don't give password) UserResponse model."""
    return UserResponse(
        username=u.username,
        role=u.role,
        height=u.height,
        weight=u.weight,
        is_deactivated=u.is_deactivated,
        macro_targets=u.macro_targets,
    )


# ── auth endpoints ────────────────────────────────────────────────────────────


@user_router.post("/signup")
async def sign_user_up(body: SignupRequest) -> dict:
    """Register a new standard user with hashed credentials."""
    existing = await User.find_one(User.username == body.username)
    if existing:
        log_event("Signup Failed", f"Username {body.username} already taken")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken.",
        )
    
    hashed = hash_password(body.password)
    user = User(username=body.username, password=str(hashed, "utf-8"), role="user")
    await user_database.save(user)
    
    log_event("Signup Success", f"New user {body.username} created")
    return {"message": "User created successfully"}


@user_router.post("/sign-in", response_model=TokenResponse)
async def sign_user_in(
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    """Authenticate user credentials and return a JWT access token."""
    db_user = await User.find_one(User.username == form_data.username)
    if not db_user or not verify_password(form_data.password, db_user.password):
        log_event("Login Failed", f"Invalid credentials for {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    # Block access if the admin has deactivated the account
    if db_user.is_deactivated:
        log_event("Login Blocked", f"Deactivated user {form_data.username} attempted login")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact admin.",
        )

    (access_token, _) = create_access_token(
        {"username": db_user.username, "role": db_user.role}
    )
    
    log_event("Login Success", f"User {db_user.username} logged in")
    return TokenResponse(
        username=db_user.username,
        role=db_user.role,
        access_token=access_token,
    )


@user_router.get("/me", response_model=UserResponse)
async def get_me(user: TokenData = Depends(authenticate)) -> UserResponse:
    """Return the currently authenticated user's profile data."""
    db_user = await User.find_one(User.username == user.username)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user_to_response(db_user)


@user_router.put("/update", response_model=UserResponse)
async def update_user_profile(
    body: UserUpdateRequest, user: TokenData = Depends(authenticate)
) -> UserResponse:
    """Update user physical metrics and nutritional goals."""
    db_user = await User.find_one(User.username == user.username)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.height is not None:
        db_user.height = body.height
    if body.weight is not None:
        db_user.weight = body.weight
    if body.macro_targets is not None:
        db_user.macro_targets = body.macro_targets

    await db_user.save()
    log_event("Profile Updated", f"User {user.username} updated profile info")
    return user_to_response(db_user)




# ── admin: management ─────────────────────────────────────────────────────────


@user_router.get("/users", response_model=list[UserResponse])
async def list_users(user: TokenData = Depends(authenticate)) -> list[UserResponse]:
    """Retrieve all registered users (Admin only)."""
    require_admin(user)
    users = await User.find_all().to_list()
    return [user_to_response(u) for u in users]


@user_router.put("/users/{username}/role")
async def set_user_role(
    username: str,
    role: str,
    user: TokenData = Depends(authenticate),
) -> dict:
    """Promote or demote a user's access level (Admin only)."""
    require_admin(user)
    if role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'.")
    
    target = await User.find_one(User.username == username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    
    target.role = role
    await target.save()
    
    log_event("Role Changed", f"User {username} role set to {role} by {user.username}")
    return {"message": f"{username} is now '{role}'."}


@user_router.put("/users/{username}/deactivate")
async def deactivate_user(
    username: str,
    deactivate: bool = True,
    user: TokenData = Depends(authenticate),
) -> dict:
    """Soft-delete an account by deactivating it (Admin only)."""
    require_admin(user)
    target = await User.find_one(User.username == username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    
    target.is_deactivated = deactivate
    await target.save()
    
    action = "deactivated" if deactivate else "activated"
    log_event("Account Status Change", f"User {username} {action} by {user.username}")
    return {"message": f"User {username} has been {action}."}


@user_router.get("/logs")
async def view_logs(limit: int = 100, user: TokenData = Depends(authenticate)) -> list[str]:
    """View application event logs from disk (Admin only)."""
    require_admin(user)
    return get_recent_logs(limit)
