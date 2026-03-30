declare module 'howler' {
  export class Howl {
    constructor(options: HowlOptions);
    play(id?: number): number;
    pause(id?: number): this;
    stop(id?: number): this;
    seek(seek?: number, id?: number): number | this;
    playing(id?: number): boolean;
    duration(id?: number): number;
    volume(volume?: number, id?: number): number | this;
    fade(from: number, to: number, duration: number, id?: number): this;
    rate(rate?: number, id?: number): number | this;
    mute(muted?: boolean, id?: number): boolean | this;
    loop(loop?: boolean, id?: number): boolean | this;
    state(): 'unloaded' | 'loading' | 'loaded';
    load(): this;
    unload(): this;
    on(event: string, callback: Function, id?: number): this;
    once(event: string, callback: Function, id?: number): this;
    off(event: string, callback?: Function, id?: number): this;
  }

  export class Howler {
    static volume(volume?: number): number | Howler;
    static mute(muted?: boolean): boolean | Howler;
    static stop(): Howler;
    static codecs(ext: string): boolean;
    static unload(): Howler;
  }

  export interface HowlOptions {
    src: string | string[];
    volume?: number;
    html5?: boolean;
    loop?: boolean;
    preload?: boolean;
    autoplay?: boolean;
    mute?: boolean;
    rate?: number;
    pool?: number;
    format?: string[];
    xhr?: {
      method?: string;
      headers?: Record<string, string>;
      withCredentials?: boolean;
    };
    // Additional properties that exist in Howler.js but not in the TypeScript definition
    xhrWithCredentials?: boolean;
    onload?: () => void;
    onloaderror?: (id: number, error: any) => void;
    onplayerror?: (id: number, error: any) => void;
    onplay?: (id: number) => void;
    onend?: (id: number) => void;
    onpause?: (id: number) => void;
    onstop?: (id: number) => void;
    onmute?: (id: number) => void;
    onvolume?: (id: number) => void;
    onrate?: (id: number) => void;
    onseek?: (id: number) => void;
    onfade?: (id: number) => void;
    onunlock?: () => void;
  }
}