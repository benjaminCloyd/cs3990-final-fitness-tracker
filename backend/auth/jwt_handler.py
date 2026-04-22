from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from pydantic import BaseModel

from database.connection import get_settings

ALGORITHM = "HS256"


class TokenData(BaseModel):
    username: str
    role: str
    exp_datetime: datetime


def create_access_token(data: dict, expires_delta: timedelta = timedelta(hours=2)):
    payload = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    payload.update({"exp": expire})
    token = jwt.encode(payload, get_settings().SECRET_KEY, ALGORITHM)
    return (token, expire)


def verify_access_token(token: str) -> TokenData | None:
    try:
        data = jwt.decode(token, get_settings().SECRET_KEY, algorithms=[ALGORITHM])
        username = data.get("username")
        role = data.get("role", "user")
        exp = data.get("exp")

        if username is None or exp is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No access token supplied",
            )

        exp_datetime = datetime.fromtimestamp(exp, tz=timezone.utc)
        if datetime.now(timezone.utc) > exp_datetime:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Token expired!"
            )

        return TokenData(username=username, role=role, exp_datetime=exp_datetime)

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
