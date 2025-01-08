import React, { useState, useEffect } from "react";
import { Grid, Paper, Typography, Avatar } from "@mui/material";
import axios from "axios";
import GoBoard from "./GoBoard";

function GoGamePage({ matchId = "sample" }) {
  const [players, setPlayers] = useState([]);
  const [blackCards, setBlackCards] = useState([]);
  const [whiteCards, setWhiteCards] = useState([]);

  useEffect(() => {
    // 这里可改成带 matchId 参数，后端按对局ID返回对应玩家
    axios
      .get("http://127.0.0.1:8000/api/v1/players")
      .then((res) => {
        setPlayers(res.data.players);
        setBlackCards(res.data.black_cards);
        setWhiteCards(res.data.white_cards);
      })
      .catch((err) => console.error("Failed to fetch player/cards:", err));
  }, []);

  // 分别找出黑白玩家
  const blackPlayer = players.find((p) => p.is_black) || {
    player_id: "??",
    elo: 0,
    avatar_url: "",
  };
  const whitePlayer = players.find((p) => !p.is_black) || {
    player_id: "??",
    elo: 0,
    avatar_url: "",
  };

  return (
    <Grid container spacing={2} style={{ padding: 16 }}>
      {/* 左：GoBoard */}
      <Grid item xs={12} md={8}>
        <GoBoard boardSize={19} />
      </Grid>
      {/* 右：Match Info */}
      <Grid item xs={12} md={4}>
        <Paper style={{ padding: 16 }}>
          <Typography variant="h5" gutterBottom>
            Match Info
          </Typography>
          <Typography>Match ID: {matchId}</Typography>

          <hr />
          <Typography variant="h6">Black Player</Typography>
          <Grid container alignItems="center" spacing={1}>
            <Grid item>
              <Avatar src={blackPlayer.avatar_url} />
            </Grid>
            <Grid item>
              <Typography>ID: {blackPlayer.player_id}</Typography>
              <Typography>ELO: {blackPlayer.elo}</Typography>
            </Grid>
          </Grid>
          <Typography>Cards:</Typography>
          {blackCards.map((card) => (
            <Paper
              key={card.card_id}
              variant="outlined"
              style={{ padding: "8px", margin: "4px 0" }}
            >
              <Typography variant="subtitle1">
                {card.name} (Cost: {card.cost})
              </Typography>
              <Typography variant="body2">{card.description}</Typography>
            </Paper>
          ))}

          <hr />
          <Typography variant="h6">White Player</Typography>
          <Grid container alignItems="center" spacing={1}>
            <Grid item>
              <Avatar src={whitePlayer.avatar_url} />
            </Grid>
            <Grid item>
              <Typography>ID: {whitePlayer.player_id}</Typography>
              <Typography>ELO: {whitePlayer.elo}</Typography>
            </Grid>
          </Grid>
          <Typography>Cards:</Typography>
          {whiteCards.map((card) => (
            <Paper
              key={card.card_id}
              variant="outlined"
              style={{ padding: "8px", margin: "4px 0" }}
            >
              <Typography variant="subtitle1">
                {card.name} (Cost: {card.cost})
              </Typography>
              <Typography variant="body2">{card.description}</Typography>
            </Paper>
          ))}
        </Paper>
      </Grid>
    </Grid>
  );
}

export default GoGamePage;
