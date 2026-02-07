import {
  type ClientOptions,
  type ClientState,
  type ClientsInterface,
  clients,
  RestClient,
} from "@/client";
import { Container, type ContainerContext } from "@/container";

declare module "@/client" {
  interface AvailableClients {
    spotify: typeof SpotifyClient;
  }
}

export interface SpotifyClientState extends ClientState {
  accessToken?: string;
}

export interface SpotifyClientOptions extends ClientOptions {
  accessToken?: string;
}

export class SpotifyClient<
  T extends SpotifyClientState = SpotifyClientState,
> extends RestClient<T> {
  // @ts-ignore
  static attach(container: Container & ClientsInterface, options?: any) {
    container.clients.register("spotify", SpotifyClient);
    return container;
  }

  constructor(options: SpotifyClientOptions, context: ContainerContext) {
    options = {
      ...options,
      baseURL: "https://api.spotify.com/v1",
    };

    super(options, context);

    if (options.accessToken) {
      this.state.set("accessToken", options.accessToken);
    }
  }

  override async beforeRequest() {
    const token = this.state.get("accessToken");
    if (token) {
      this.axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    this.axios.defaults.headers.common["Accept"] = "application/json";
    this.axios.defaults.headers.common["Content-Type"] = "application/json";
  }

  setAccessToken(token: string) {
    this.state.set("accessToken", token);
  }

  /**
   * Override get to retry once on 429 (rate limit) using Spotify's Retry-After header.
   * Rate limits are per app in a rolling 30s window — same token from web app shares quota.
   */
  override async get(
    url: string,
    params: any = {},
    options: import("axios").AxiosRequestConfig = {}
  ) {
    await this.beforeRequest();
    const doRequest = () =>
      this.axios({ ...options, method: "GET", url, params });
    try {
      const res = await doRequest();
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 429) {
        const retryAfter = parseInt(
          e.response?.headers?.["retry-after"] ?? "1",
          10
        );
        await new Promise((r) => setTimeout(r, Math.min(retryAfter, 60) * 1000));
        const retry = await doRequest();
        return retry.data;
      }
      if (e?.isAxiosError) return this.handleError(e);
      throw e;
    }
  }

  async listPlaylists(
    userId?: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<PaginatedResponse<SimplifiedPlaylist>> {
    const path = userId ? `/users/${userId}/playlists` : "/me/playlists";
    return this.get(path, { limit, offset });
  }

  async listPlaylistTracks(
    playlistId: string,
    { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<PaginatedResponse<PlaylistTrackItem>> {
    return this.get(`/playlists/${playlistId}/tracks`, { limit, offset });
  }

  async viewTrackInfo(trackId: string): Promise<Track> {
    return this.get(`/tracks/${trackId}`);
  }
}

// --- Types ---

export type PaginatedResponse<T> = {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
};

export type SimplifiedPlaylist = {
  collaborative: boolean;
  description: string | null;
  external_urls: { spotify: string };
  href: string;
  id: string;
  images: SpotifyImage[];
  name: string;
  owner: {
    display_name: string;
    external_urls: { spotify: string };
    href: string;
    id: string;
    type: string;
    uri: string;
  };
  public: boolean | null;
  snapshot_id: string;
  tracks: { href: string; total: number };
  type: string;
  uri: string;
};

export type PlaylistTrackItem = {
  added_at: string;
  added_by: {
    external_urls: { spotify: string };
    href: string;
    id: string;
    type: string;
    uri: string;
  };
  is_local: boolean;
  track: Track;
};

export type Track = {
  album: {
    album_type: string;
    total_tracks: number;
    external_urls: { spotify: string };
    href: string;
    id: string;
    images: SpotifyImage[];
    name: string;
    release_date: string;
    release_date_precision: string;
    type: string;
    uri: string;
    artists: SimplifiedArtist[];
  };
  artists: SimplifiedArtist[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_ids: { isrc?: string; ean?: string; upc?: string };
  external_urls: { spotify: string };
  href: string;
  id: string;
  is_playable: boolean;
  name: string;
  popularity: number;
  preview_url: string | null;
  track_number: number;
  type: string;
  uri: string;
  is_local: boolean;
};

export type SimplifiedArtist = {
  external_urls: { spotify: string };
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
};

export type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

export default clients.register("spotify", SpotifyClient);
