// GoBoard.js
import React, { useState } from "react";
import axios from "axios";
import "./GoBoard.css";

const GoBoard = ({ boardSize = 19, matchId }) => {
    const [board, setBoard] = useState(
        Array.from({ length: boardSize }, () => Array(boardSize).fill(null))
    );
    const [currentPlayer, setCurrentPlayer] = useState("black");
    const [message, setMessage] = useState("");

    const handleCellClick = (x, y) => {
        if (!matchId) {
            setMessage("No match ID!");
            return;
        }
        if (board[x][y] !== null) {
            setMessage("Cell occupied!");
            return;
        }

        const token = localStorage.getItem("token");
        axios
            .post(
                `http://127.0.0.1:8000/api/v1/matches/${matchId}/move`,
                { x, y },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            .then((res) => {
                setBoard(res.data.board);
                setCurrentPlayer(res.data.current_player);
                setMessage(res.data.message);
            })
            .catch((err) => {
                console.error("Error making a move:", err);
                setMessage(err.response?.data?.detail || "An error occurred");
            });
    };

    const handlePass = () => {
        if (!matchId) {
            setMessage("No match ID!");
            return;
        }

        const token = localStorage.getItem("token");
        axios
            .post(
                `http://127.0.0.1:8000/api/v1/matches/${matchId}/move`,
                { x: null, y: null },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            .then((res) => {
                setBoard(res.data.board);
                setCurrentPlayer(res.data.current_player);
                setMessage(res.data.message);
            })
            .catch((err) => {
                console.error("Error passing:", err);
                setMessage(err.response?.data?.detail || "An error occurred");
            });
    };

    return (
        <div>
            <div className="go-board-container">
                <div className="go-board">
                    <div className="board">
                        {board.map((row, x) =>
                            row.map((cell, y) => (
                                <div
                                    key={`${x}-${y}`}
                                    className="board-cell"
                                    onClick={() => handleCellClick(x, y)}
                                >
                                    {cell === "black" && <div className="stone black" />}
                                    {cell === "white" && <div className="stone white" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            <button onClick={handlePass}>Pass</button>
            <p>Current Player: {currentPlayer}</p>
            <p>{message}</p>
        </div>
    );
};

export default GoBoard;
