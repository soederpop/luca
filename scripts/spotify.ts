import container from "@/node";
import SpotifyClient from "@/clients/spotify";

container.clients.register("spotify", SpotifyClient);

// Token from env to avoid committing. Use the same app as your web app = shared rate limit (429).
// If you get 429, the client will retry once after Retry-After seconds; otherwise wait ~30s or use a different app.
const spotify = container.client("spotify", {
  accessToken: process.env.SPOTIFY_ACCESS_TOKEN,
});

spotify.listPlaylists().then(
  (resp) => console.log(resp),
  (err) => console.error("Spotify error:", err)
);