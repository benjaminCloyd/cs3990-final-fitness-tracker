from auth.authenticate import authenticate
from auth.hash_password import hash_password, verify_password
from auth.jwt_handler import TokenData, create_access_token
from database.connection import Database
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from models import TokenResponse, User

user_router = APIRouter()
user_database = Database(User)


@user_router.post("/signup")
async def sign_user_up(user: User) -> dict:
    existing = await User.find_one(User.username == user.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken.",
        )
    hashed = hash_password(user.password)
    user.password = str(hashed, "utf-8")
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
    (access_token, _) = create_access_token({"username": db_user.username})
    return TokenResponse(username=db_user.username, access_token=access_token)


@user_router.get("/me")
async def get_me(user: TokenData = Depends(authenticate)) -> dict:
    return {"username": user.username}
