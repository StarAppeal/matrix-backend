export interface LastFmImage {
    "#text": string;
}

export interface LastFmArtist {
    "#text": string;
}

export interface LastFmTrackAttr {
    nowplaying: string;
}

export interface LastFmTrack {
    name: string;
    artist: LastFmArtist;
    image: LastFmImage[];
    "@attr"?: LastFmTrackAttr;
}

export interface LastFmRecentTracksResponse {
    recenttracks?: {
        track: LastFmTrack[];
    };
}
