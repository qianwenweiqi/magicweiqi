<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/lobby" element={<Lobby />} />
  <Route path="/game/:id" element={<Game />} />
  {/* 移除 /room 路由 */}
</Routes> 