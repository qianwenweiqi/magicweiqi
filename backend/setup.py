from setuptools import setup, find_packages

setup(
    name="backend",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "websockets",
        "python-jose[cryptography]",
        "passlib[bcrypt]",
        "python-multipart",
        "sqlalchemy",
        "pydantic",
        "python-dotenv",
    ],
    python_requires=">=3.8",
)
