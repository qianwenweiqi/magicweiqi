// GoGamePage.jsx
import React, { useState, useEffect } from "react";
import { Grid, Paper, Typography, Avatar } from "@mui/material";
import axios from "axios";
import GoBoard from "../components/GoBoard";

function GoGamePage() {
    const [matchId, setMatchId] = useState(null);
    const [players, setPlayers] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        // Fetch or create a match for the logged-in user
        const token = localStorage.getItem("token");
        axios
            .post(
                "http://127.0.0.1:8000/api/v1/matches",
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            .then((res) => {
                setMatchId(res.data.match_id);
                setErrorMessage("");
            })
            .catch((err) => {
                console.error("Failed to create or get match:", err);
                setErrorMessage("Failed to load game data.");
            });
    }, []);

    useEffect(() => {
        if (!matchId) return;

        // Fetch players and cards data for the match
        const token = localStorage.getItem("token");
        axios
            .get(`http://127.0.0.1:8000/api/v1/matches/${matchId}/players`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            .then((res) => {
                setPlayers(res.data.players);
                setErrorMessage("");
            })
            .catch((err) => {
                console.error("Failed to fetch player/cards:", err);
                setErrorMessage("Failed to load player data.");
            });
    }, [matchId]);

    const blackPlayer = players.find((p) => p.player_id === "black") || {
        player_id: "Unknown",
        elo: "N/A",
        avatar_url: "",
    };
    const whitePlayer = players.find((p) => p.player_id === "white") || {
        player_id: "Unknown",
        elo: "N/A",
        avatar_url: "",
    };

    return (
        <Grid container spacing={2} style={{ padding: 16 }}>
            <Grid item xs={12} md={8}>
                <GoBoard boardSize={19} matchId={matchId} />
            </Grid>
            <Grid item xs={12} md={4}>
                <Paper style={{ padding: 16 }}>
                    <Typography variant="h5" gutterBottom>
                        Match Info
                    </Typography>
                    {errorMessage ? (
                        <Typography color="error">{errorMessage}</Typography>
                    ) : (
                        <>
                            <Typography>Match ID: {matchId || "N/A"}</Typography>
                            <hr />
                            <Typography variant="h6">Black Player</Typography>
                            <Avatar src={blackPlayer.avatar_url} />
                            <Typography>ID: {blackPlayer.player_id}</Typography>
                            <Typography>ELO: {blackPlayer.elo}</Typography>
                            <Typography variant="h6">White Player</Typography>
                            <Avatar src={whitePlayer.avatar_url} />
                            <Typography>ID: {whitePlayer.player_id}</Typography>
                            <Typography>ELO: {whitePlayer.elo}</Typography>
                        </>
                    )}
                </Paper>
            </Grid>
        </Grid>
    );
}

export default GoGamePage;
