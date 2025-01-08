from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import matches

app = FastAPI()

# 跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 视情况修改
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(matches.router, prefix="/api/v1", tags=["matches"])

@app.get("/")
def read_root():
    return {"message": "Hello from your Go server with Ko & Resign features!"}
