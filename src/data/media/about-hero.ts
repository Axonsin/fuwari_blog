export interface AboutHeroRendition {
	id: "av1" | "h264";
	src: string;
	container: "video/mp4";
	codec: string;
	contentType: string;
	width: number;
	height: number;
	frameRate: number;
	frameCount: number;
	videoBitRate: number;
	bytes: number;
	duration: number;
	sha256: string;
	vmaf: number;
}

export interface AboutHeroMetadata {
	version: 1;
	duration: number;
	poster: {
		src: string;
		width: number;
		height: number;
		bytes: number;
		sha256: string;
	};
	audio: {
		codec: "mp4a.40.2";
		profile: "AAC-LC";
		sampleRate: 48000;
		channels: 2;
		bitRate: number;
	};
	renditions: readonly [AboutHeroRendition, AboutHeroRendition];
	playback: {
		preload: "auto";
		muted: true;
		playsInline: true;
		loop: true;
		bufferGate: "canplaythrough-or-have-enough-data";
	};
	presentation: {
		heroHeightVh: number;
		contentOverlapRem: number;
		objectFit: "cover";
		objectPosition: "center";
		blurStart: number;
		blurEnd: number;
		maxBlurPx: number;
		fadeStart: number;
		fadeEnd: number;
		dprCap: number;
		credit: string;
	};
}

// Encoding facts below are generated from the shipped files with ffprobe and
// sha256, rather than estimated from encoder settings.
export const aboutHero: AboutHeroMetadata = {
	version: 1,
	duration: 30.066667,
	poster: {
		src: "/media/about/hero/about-hero.v1.poster.webp",
		width: 1920,
		height: 1080,
		bytes: 160632,
		sha256: "d8f24f44943c8c17163f0e05734eed01e5c6ff7d8162fa553da2e71d191c79a5",
	},
	audio: {
		codec: "mp4a.40.2",
		profile: "AAC-LC",
		sampleRate: 48000,
		channels: 2,
		bitRate: 96649,
	},
	renditions: [
		{
			id: "av1",
			src: "/media/about/hero/about-hero.v1.av1-1080p60.mp4",
			container: "video/mp4",
			codec: "av01.0.09M.08.0.110.01.01.01.0",
			contentType: 'video/mp4; codecs="av01.0.09M.08.0.110.01.01.01.0"',
			width: 1920,
			height: 1080,
			frameRate: 60,
			frameCount: 1804,
			videoBitRate: 2708046,
			bytes: 10578141,
			duration: 30.066667,
			sha256:
				"5534f9cbf71fc08aae3ea0335ab426f5056a95b3357112faf8e1a448bb79397e",
			vmaf: 75.840788,
		},
		{
			id: "h264",
			src: "/media/about/hero/about-hero.v1.h264-1080p30.mp4",
			container: "video/mp4",
			codec: "avc1.640029",
			contentType: 'video/mp4; codecs="avc1.640029"',
			width: 1920,
			height: 1080,
			frameRate: 30,
			frameCount: 902,
			videoBitRate: 2960121,
			bytes: 11522984,
			duration: 30.066667,
			sha256:
				"6b27d915de1cbf6e9d7a9fd85598386dc8d55a2bb3a5e0aec1e8e7fa2a8e56b6",
			vmaf: 91.587419,
		},
	],
	playback: {
		preload: "auto",
		muted: true,
		playsInline: true,
		loop: true,
		bufferGate: "canplaythrough-or-have-enough-data",
	},
	presentation: {
		heroHeightVh: 65,
		contentOverlapRem: 3.5,
		objectFit: "cover",
		objectPosition: "center",
		blurStart: 0,
		blurEnd: 0.7,
		maxBlurPx: 24,
		fadeStart: 0.25,
		fadeEnd: 0.9,
		dprCap: 1.25,
		credit: "マチアプリンセス / 雨衣・玉姫",
	},
};
