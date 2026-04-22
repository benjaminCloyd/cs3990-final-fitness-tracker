from auth.authenticate import authenticate
from auth.hash_password import hash_password, verify_password
from auth.jwt_handler import TokenData, create_access_token
from database.connection import Database
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from models import SignupRequest, TokenResponse, User, UserResponse

user_router = APIRouter()
user_database = Database(User)


# ── helpers ───────────────────────────────────────────────────────────────────


def require_admin(user: TokenData):
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )


# ── auth endpoints ────────────────────────────────────────────────────────────


@user_router.post("/signup")
async def sign_user_up(body: SignupRequest) -> dict:
    existing = await User.find_one(User.username == body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken.",
        )
    hashed = hash_password(body.password)
    # Role is always "user" on self-signup — admins are promoted via /auth/users/{username}/role
    user = User(username=body.username, password=str(hashed, "utf-8"), role="user")
    await user_database.save(user)
    return {"message": "User created successfully"}


@user_router.post("/sign-in", response_model=TokenResponse)
async def sign_user_in(
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> TokenResponse:
    db_user = await User.find_one(User.username == form_data.username)
    if not db_user or not verify_password(form_data.password, db_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    (access_token, _) = create_access_token(
        {"username": db_user.username, "role": db_user.role}
    )
    return TokenResponse(
        username=db_user.username,
        role=db_user.role,
        access_token=access_token,
    )


@user_router.get("/me")
async def get_me(user: TokenData = Depends(authenticate)) -> dict:
    return {"username": user.username, "role": user.role}


# ── admin: user management ────────────────────────────────────────────────────


@user_router.get("/users", response_model=list[UserResponse])
async def list_users(user: TokenData = Depends(authenticate)) -> list[UserResponse]:
    require_admin(user)
    users = await User.find_all().to_list()
    return [UserResponse(username=u.username, role=u.role) for u in users]


@user_router.put("/users/{username}/role")
async def set_user_role(
    username: str,
    role: str,
    user: TokenData = Depends(authenticate),
) -> dict:
    require_admin(user)
    if role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'.")
    target = await User.find_one(User.username == username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    target.role = role
    await target.save()
    return {"message": f"{username} is now '{role}'."}
