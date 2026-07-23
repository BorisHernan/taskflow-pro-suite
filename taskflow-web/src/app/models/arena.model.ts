export interface BlobView {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  bot: boolean;
}

export interface Pellet {
  id: string;
  x: number;
  y: number;
  big: boolean;
}

export interface ArenaSnapshot {
  blobs: BlobView[];
  pellets: Pellet[];
  worldSize: number;
}

export interface WelcomeMessage {
  type: 'welcome';
  id: string;
}
