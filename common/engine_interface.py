from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class EngineInterface(ABC):
    """
    Abstract Base Class for Klever Desktop Automation Engines.
    All engines (GELab, Legacy, Browser, etc.) must implement this interface.
    """

    @abstractmethod
    def start(self) -> bool:
        """
        Initialize and start the engine.
        Returns:
            bool: True if started successfully, False otherwise.
        """
        pass

    @abstractmethod
    def stop(self) -> bool:
        """
        Stop and cleanup the engine.
        Returns:
            bool: True if stopped successfully.
        """
        pass

    @abstractmethod
    def execute_task(self, task: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a specific automation task.
        
        Args:
            task: The natural language task description or task ID.
            params: Optional parameters for execution.
            
        Returns:
            Dict: Execution result (success, artifacts, logs, etc.)
        """
        pass

    @abstractmethod
    def get_status(self) -> str:
        """
        Get current status of the engine.
        Returns:
            str: Status string (e.g., 'IDLE', 'RUNNING', 'ERROR')
        """
        pass
