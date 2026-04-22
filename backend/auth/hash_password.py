import bcrypt


def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())


def verify_password(input_password: str, db_password: str) -> bool:
    return bcrypt.checkpw(input_password.encode(), db_password.encode())
