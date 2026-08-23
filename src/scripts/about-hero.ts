import type {
	AboutHeroMetadata,
	AboutHeroRendition,
} from "@/data/media/about-hero";

interface NetworkInformationLike {
	saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
	connection?: NetworkInformationLike;
}

interface RenderTarget {
	framebuffer: WebGLFramebuffer;
	texture: WebGLTexture;
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
	vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
	vUv = position;
	gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const COPY_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uUvScale;
in vec2 vUv;
out vec4 outColor;
void main() {
	vec2 uv = (vUv - 0.5) * uUvScale + 0.5;
	outColor = texture(uTexture, uv);
}`;

const KAWASE_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform float uOffset;
in vec2 vUv;
out vec4 outColor;
void main() {
	vec2 delta = uTexel * uOffset;
	outColor = 0.25 * (
		texture(uTexture, vUv + vec2(-delta.x, -delta.y)) +
		texture(uTexture, vUv + vec2( delta.x, -delta.y)) +
		texture(uTexture, vUv + vec2(-delta.x,  delta.y)) +
		texture(uTexture, vUv + vec2( delta.x,  delta.y))
	);
}`;

function clamp(value: number, min = 0, max = 1): number {
	return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const progress = clamp((value - edge0) / (edge1 - edge0));
	return progress * progress * (3 - 2 * progress);
}

function compileShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Unable to create WebGL shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
		gl.deleteShader(shader);
		throw new Error(message);
	}
	return shader;
}

function createProgram(
	gl: WebGL2RenderingContext,
	fragmentSource: string,
): WebGLProgram {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();
	if (!program) throw new Error("Unable to create WebGL program");
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) || "Unknown program error";
		gl.deleteProgram(program);
		throw new Error(message);
	}
	return program;
}

class DualKawaseRenderer {
	private readonly gl: WebGL2RenderingContext;
	private readonly copyProgram: WebGLProgram;
	private readonly blurProgram: WebGLProgram;
	private readonly videoTexture: WebGLTexture;
	private targets: RenderTarget[] = [];
	private targetWidth = 0;
	private targetHeight = 0;
	private disposed = false;
	private readonly handleContextLost: (event: Event) => void;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly dprCap: number,
		onContextLost: () => void,
	) {
		const gl = canvas.getContext("webgl2", {
			alpha: true,
			antialias: false,
			depth: false,
			stencil: false,
			powerPreference: "high-performance",
			premultipliedAlpha: false,
			preserveDrawingBuffer: false,
		});
		if (!gl) throw new Error("WebGL2 is unavailable");
		this.gl = gl;
		this.copyProgram = createProgram(gl, COPY_SHADER);
		this.blurProgram = createProgram(gl, KAWASE_SHADER);
		const videoTexture = gl.createTexture();
		if (!videoTexture) throw new Error("Unable to create video texture");
		this.videoTexture = videoTexture;
		this.configureTexture(videoTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([0, 0, 0, 255]),
		);
		this.handleContextLost = (event) => {
			event.preventDefault();
			onContextLost();
		};
		canvas.addEventListener("webglcontextlost", this.handleContextLost);
	}

	private configureTexture(texture: WebGLTexture): void {
		const gl = this.gl;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	private createTarget(width: number, height: number): RenderTarget {
		const gl = this.gl;
		const texture = gl.createTexture();
		const framebuffer = gl.createFramebuffer();
		if (!texture || !framebuffer) {
			throw new Error("Unable to create blur render target");
		}
		this.configureTexture(texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			width,
			height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			texture,
			0,
		);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
			throw new Error("Blur framebuffer is incomplete");
		}
		return { framebuffer, texture };
	}

	private ensureSize(): void {
		const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
		const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
		const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
		}
		const targetWidth = Math.max(1, Math.ceil(width / 2));
		const targetHeight = Math.max(1, Math.ceil(height / 2));
		if (
			this.targetWidth === targetWidth &&
			this.targetHeight === targetHeight &&
			this.targets.length === 2
		) {
			return;
		}
		this.deleteTargets();
		this.targetWidth = targetWidth;
		this.targetHeight = targetHeight;
		this.targets = [
			this.createTarget(targetWidth, targetHeight),
			this.createTarget(targetWidth, targetHeight),
		];
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
	}

	private drawCopy(
		texture: WebGLTexture,
		framebuffer: WebGLFramebuffer | null,
		width: number,
		height: number,
		uvScaleX: number,
		uvScaleY: number,
	): void {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.viewport(0, 0, width, height);
		gl.useProgram(this.copyProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(gl.getUniformLocation(this.copyProgram, "uTexture"), 0);
		gl.uniform2f(
			gl.getUniformLocation(this.copyProgram, "uUvScale"),
			uvScaleX,
			uvScaleY,
		);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	private drawBlur(
		texture: WebGLTexture,
		framebuffer: WebGLFramebuffer,
		offset: number,
	): void {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.viewport(0, 0, this.targetWidth, this.targetHeight);
		gl.useProgram(this.blurProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(gl.getUniformLocation(this.blurProgram, "uTexture"), 0);
		gl.uniform2f(
			gl.getUniformLocation(this.blurProgram, "uTexel"),
			1 / this.targetWidth,
			1 / this.targetHeight,
		);
		gl.uniform1f(gl.getUniformLocation(this.blurProgram, "uOffset"), offset);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	render(video: HTMLVideoElement, blurPx: number): void {
		if (this.disposed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
			return;
		this.ensureSize();
		const gl = this.gl;
		gl.disable(gl.BLEND);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

		const outputAspect = this.canvas.width / this.canvas.height;
		const videoAspect = (video.videoWidth || 16) / (video.videoHeight || 9);
		const uvScaleX = Math.min(1, outputAspect / videoAspect);
		const uvScaleY = Math.min(1, videoAspect / outputAspect);

		if (blurPx < 0.25) {
			this.drawCopy(
				this.videoTexture,
				null,
				this.canvas.width,
				this.canvas.height,
				uvScaleX,
				uvScaleY,
			);
			return;
		}

		this.drawCopy(
			this.videoTexture,
			this.targets[0].framebuffer,
			this.targetWidth,
			this.targetHeight,
			uvScaleX,
			uvScaleY,
		);
		const passes = clamp(Math.ceil(2 + blurPx / 12), 2, 4);
		let sourceIndex = 0;
		for (let pass = 0; pass < passes; pass += 1) {
			const destinationIndex = 1 - sourceIndex;
			const offset = 0.75 + (blurPx / 24) * (pass + 1) * 1.5;
			this.drawBlur(
				this.targets[sourceIndex].texture,
				this.targets[destinationIndex].framebuffer,
				offset,
			);
			sourceIndex = destinationIndex;
		}
		this.drawCopy(
			this.targets[sourceIndex].texture,
			null,
			this.canvas.width,
			this.canvas.height,
			1,
			1,
		);
	}

	private deleteTargets(): void {
		for (const target of this.targets) {
			this.gl.deleteFramebuffer(target.framebuffer);
			this.gl.deleteTexture(target.texture);
		}
		this.targets = [];
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
		this.deleteTargets();
		this.gl.deleteTexture(this.videoTexture);
		this.gl.deleteProgram(this.copyProgram);
		this.gl.deleteProgram(this.blurProgram);
	}
}

class AboutHeroController {
	private readonly root: HTMLElement;
	private readonly video: HTMLVideoElement;
	private readonly canvas: HTMLCanvasElement;
	private readonly progress: HTMLElement;
	private readonly metadata: AboutHeroMetadata;
	private renderer: DualKawaseRenderer | null = null;
	private intersectionObserver: IntersectionObserver | null = null;
	private cleanupCallbacks: Array<() => void> = [];
	private videoFrameCallback = 0;
	private scrollFrame = 0;
	private blurPx = 0;
	private opacity = 1;
	private enoughData = false;
	private intersectsViewport = true;
	private playPending = false;
	private playSucceeded = false;
	private useDomFallback = false;
	private disposed = false;

	constructor(root: HTMLElement) {
		this.root = root;
		const video = root.querySelector<HTMLVideoElement>(".about-hero__video");
		const canvas = root.querySelector<HTMLCanvasElement>(".about-hero__canvas");
		const progress = root.querySelector<HTMLElement>(
			".about-hero__buffer-value",
		);
		if (!video || !canvas || !progress) {
			throw new Error("About Hero markup is incomplete");
		}
		this.video = video;
		this.canvas = canvas;
		this.progress = progress;
		this.metadata = JSON.parse(
			root.dataset.aboutHero || "null",
		) as AboutHeroMetadata;
		if (!this.metadata?.renditions?.length) {
			throw new Error("About Hero metadata is missing");
		}
	}

	async start(): Promise<void> {
		this.attachViewportObservers();
		this.updateScrollState();
		if (this.shouldUsePosterOnly()) {
			this.root.classList.add("is-poster-only");
			return;
		}
		const rendition = await this.selectRendition();
		if (this.disposed) return;
		if (!rendition) {
			this.root.classList.add("is-poster-only");
			return;
		}
		this.prepareVideo(rendition);
	}

	private shouldUsePosterOnly(): boolean {
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const saveData =
			(navigator as NavigatorWithConnection).connection?.saveData === true;
		return reducedMotion || saveData;
	}

	private async decodingInfo(rendition: AboutHeroRendition) {
		if (!navigator.mediaCapabilities?.decodingInfo) return null;
		try {
			return await navigator.mediaCapabilities.decodingInfo({
				type: "file",
				video: {
					contentType: rendition.contentType,
					width: rendition.width,
					height: rendition.height,
					bitrate: rendition.videoBitRate,
					framerate: rendition.frameRate,
				},
				audio: {
					contentType: 'audio/mp4; codecs="mp4a.40.2"',
					channels: "2",
					bitrate: this.metadata.audio.bitRate,
					samplerate: this.metadata.audio.sampleRate,
				},
			});
		} catch {
			return null;
		}
	}

	private async selectRendition(): Promise<AboutHeroRendition | null> {
		const av1 = this.metadata.renditions.find((item) => item.id === "av1");
		const h264 = this.metadata.renditions.find((item) => item.id === "h264");
		if (!h264) return null;
		if (!navigator.mediaCapabilities?.decodingInfo) {
			return this.video.canPlayType(h264.contentType) ? h264 : null;
		}

		if (av1) {
			const info = await this.decodingInfo(av1);
			if (info?.supported && info.smooth && info.powerEfficient) return av1;
		}
		const fallbackInfo = await this.decodingInfo(h264);
		if (fallbackInfo?.supported && fallbackInfo.smooth) return h264;
		return null;
	}

	private listen<K extends keyof HTMLMediaElementEventMap>(
		target: HTMLVideoElement,
		type: K,
		listener: (event: HTMLMediaElementEventMap[K]) => void,
	): void {
		target.addEventListener(type, listener);
		this.cleanupCallbacks.push(() =>
			target.removeEventListener(type, listener),
		);
	}

	private prepareVideo(rendition: AboutHeroRendition): void {
		this.video.muted = true;
		this.video.defaultMuted = true;
		this.video.loop = true;
		this.video.playsInline = true;
		this.video.preload = "auto";
		this.video.src = rendition.src;
		this.root.dataset.selectedRendition = rendition.id;

		const updateProgress = () => this.updateBufferProgress();
		this.listen(this.video, "progress", updateProgress);
		this.listen(this.video, "durationchange", updateProgress);
		this.listen(this.video, "loadedmetadata", updateProgress);
		this.listen(this.video, "loadeddata", () => {
			this.updateBufferProgress();
			this.checkEnoughData();
		});
		this.listen(this.video, "canplaythrough", () => this.openPlaybackGate());
		this.listen(this.video, "error", () => this.failToPoster());
		this.video.load();
		this.checkEnoughData();
	}

	private updateBufferProgress(): void {
		const duration = Number.isFinite(this.video.duration)
			? this.video.duration
			: this.metadata.duration;
		let bufferedEnd = 0;
		for (let index = 0; index < this.video.buffered.length; index += 1) {
			bufferedEnd = Math.max(bufferedEnd, this.video.buffered.end(index));
		}
		const ratio = duration > 0 ? clamp(bufferedEnd / duration) : 0;
		this.progress.style.width = `${ratio * 100}%`;
	}

	private checkEnoughData(): void {
		if (this.video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
			this.openPlaybackGate();
		}
	}

	private openPlaybackGate(): void {
		if (this.enoughData || this.disposed) return;
		this.enoughData = true;
		this.progress.style.width = "100%";
		this.syncPlayback();
	}

	private attachViewportObservers(): void {
		const rect = this.root.getBoundingClientRect();
		this.intersectsViewport = rect.bottom > 0 && rect.top < window.innerHeight;
		this.intersectionObserver = new IntersectionObserver((entries) => {
			this.intersectsViewport = entries.some((entry) => entry.isIntersecting);
			this.syncPlayback();
		});
		this.intersectionObserver.observe(this.root);

		const requestScrollUpdate = () => {
			if (this.scrollFrame) return;
			this.scrollFrame = window.requestAnimationFrame(() => {
				this.scrollFrame = 0;
				this.updateScrollState();
			});
		};
		window.addEventListener("scroll", requestScrollUpdate, { passive: true });
		window.addEventListener("resize", requestScrollUpdate, { passive: true });
		const handleVisibility = () => this.syncPlayback();
		document.addEventListener("visibilitychange", handleVisibility);
		this.cleanupCallbacks.push(
			() => window.removeEventListener("scroll", requestScrollUpdate),
			() => window.removeEventListener("resize", requestScrollUpdate),
			() => document.removeEventListener("visibilitychange", handleVisibility),
		);
	}

	private updateScrollState(): void {
		if (this.disposed) return;
		const rect = this.root.getBoundingClientRect();
		const progress = rect.height > 0 ? clamp(-rect.top / rect.height) : 0;
		const presentation = this.metadata.presentation;
		this.blurPx =
			presentation.maxBlurPx *
			smoothstep(presentation.blurStart, presentation.blurEnd, progress);
		this.opacity =
			1 - smoothstep(presentation.fadeStart, presentation.fadeEnd, progress);
		this.root.style.opacity = this.opacity.toFixed(4);
		this.root.style.setProperty(
			"--about-hero-css-blur",
			`${this.blurPx.toFixed(2)}px`,
		);
		this.root.style.setProperty(
			"--about-hero-css-scale",
			(1 + this.blurPx / 800).toFixed(4),
		);
		this.syncPlayback();
	}

	private shouldPlay(): boolean {
		return (
			this.enoughData &&
			this.intersectsViewport &&
			this.opacity > 0.01 &&
			!document.hidden &&
			!this.disposed
		);
	}

	private syncPlayback(): void {
		if (this.shouldPlay()) {
			void this.play();
		} else {
			this.pause();
		}
	}

	private async play(): Promise<void> {
		if (this.playPending || (!this.video.paused && this.playSucceeded)) return;
		this.playPending = true;
		try {
			await this.video.play();
			if (this.disposed) return;
			this.playSucceeded = true;
			this.root.classList.add("is-playing");
			if (!("requestVideoFrameCallback" in this.video)) {
				this.switchToDomFallback();
				return;
			}
			if (!this.useDomFallback) this.ensureRenderer();
			if (this.useDomFallback) {
				this.root.classList.add("is-video-fallback");
			} else {
				this.scheduleVideoFrame();
			}
		} catch {
			this.failToPoster();
		} finally {
			this.playPending = false;
		}
	}

	private pause(): void {
		if (!this.video.paused) this.video.pause();
		if (this.videoFrameCallback && "cancelVideoFrameCallback" in this.video) {
			this.video.cancelVideoFrameCallback(this.videoFrameCallback);
			this.videoFrameCallback = 0;
		}
	}

	private ensureRenderer(): void {
		if (this.renderer || this.useDomFallback) return;
		try {
			this.renderer = new DualKawaseRenderer(
				this.canvas,
				this.metadata.presentation.dprCap,
				() => this.switchToDomFallback(),
			);
		} catch {
			this.switchToDomFallback();
		}
	}

	private scheduleVideoFrame(): void {
		if (
			this.videoFrameCallback ||
			this.video.paused ||
			this.useDomFallback ||
			!this.renderer
		) {
			return;
		}
		this.videoFrameCallback = this.video.requestVideoFrameCallback(() => {
			this.videoFrameCallback = 0;
			if (this.disposed || this.video.paused || !this.renderer) return;
			try {
				this.renderer.render(this.video, this.blurPx);
				this.root.classList.add("is-canvas-ready");
				this.scheduleVideoFrame();
			} catch {
				this.switchToDomFallback();
			}
		});
	}

	private switchToDomFallback(): void {
		this.useDomFallback = true;
		this.root.classList.remove("is-canvas-ready");
		this.renderer?.dispose();
		this.renderer = null;
		if (this.playSucceeded) this.root.classList.add("is-video-fallback");
	}

	private failToPoster(): void {
		this.pause();
		this.root.classList.remove(
			"is-playing",
			"is-canvas-ready",
			"is-video-fallback",
		);
		this.root.classList.add("is-error");
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.pause();
		if (this.scrollFrame) window.cancelAnimationFrame(this.scrollFrame);
		this.intersectionObserver?.disconnect();
		for (const cleanup of this.cleanupCallbacks) cleanup();
		this.cleanupCallbacks = [];
		this.renderer?.dispose();
		this.renderer = null;
		this.video.removeAttribute("src");
		this.video.load();
	}
}

let activeController: AboutHeroController | null = null;

export async function initializeAboutHero(): Promise<void> {
	const root = document.getElementById("about-hero");
	if (!(root instanceof HTMLElement)) {
		destroyAboutHero();
		return;
	}
	destroyAboutHero();
	try {
		const controller = new AboutHeroController(root);
		activeController = controller;
		await controller.start();
	} catch {
		root.classList.add("is-error");
	}
}

export function destroyAboutHero(): void {
	activeController?.dispose();
	activeController = null;
}
