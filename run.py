import sys
import os
from pathlib import Path

# Add the project root directory to Python path
project_root = Path(__file__).parent
sys.path.append(str(project_root))

# Run the uvicorn server
if __name__ == "__main__":
    import uvicorn
    import logging

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)
    
    # Disable auto-reload to maintain state
    logger.info("Starting server without auto-reload to maintain match state")
    uvicorn.run(
        "backend.main:application",
        host="0.0.0.0",  # 允许所有主机访问
        port=8000,
        reload=False,  # Disable reload to prevent state reinitialization
        log_level="info"
    )
