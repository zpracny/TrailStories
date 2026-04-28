import { EXPORT_FPS, EXPORT_BITRATE, EXPORT_FORMAT, EXPORT_FALLBACK } from './storyConstants'
import type { ExportFormat } from './storyTypes'

const FRAME_DURATION_US = Math.round(1_000_000 / EXPORT_FPS)

// H.264 Constrained Baseline Level 5.0 — no B-frames, so PTS = DTS always.
// Main/High profiles allow B-frames, causing out-of-order DTS that breaks mp4-muxer.
const H264_CODEC = 'avc1.42e032'
const VP8_CODEC  = 'vp8'

/**
 * Encode frames from `exportCanvas` into video.
 * `renderFn` must draw the frame for the given progress into `exportCanvas` before returning.
 */
export async function encodeVideo(
  exportCanvas: HTMLCanvasElement,
  totalFrames: number,
  format: ExportFormat,
  renderFn: (frame: number, progress: number) => Promise<void> | void,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const { width, height } = exportCanvas

  // ── WebCodecs path ─────────────────────────────────────────────────────────
  if (typeof VideoEncoder !== 'undefined') {
    const isMP4 = format === 'mp4'

    // Import muxer and set up direct-pipe encoder
    if (isMP4) {
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
      const target = new ArrayBufferTarget()
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width, height },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      })
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => console.error('VideoEncoder', e),
      })
      encoder.configure({ codec: H264_CODEC, width, height, bitrate: EXPORT_BITRATE, framerate: EXPORT_FPS })
      await runEncodeLoop(encoder, exportCanvas, totalFrames, renderFn, onProgress)
      muxer.finalize()
      return new Blob([target.buffer], { type: 'video/mp4' })
    } else {
      const { Muxer, ArrayBufferTarget } = await import('webm-muxer')
      const target = new ArrayBufferTarget()
      const muxer = new Muxer({
        target,
        video: { codec: 'V_VP8', width, height, frameRate: EXPORT_FPS },
        firstTimestampBehavior: 'offset',
      })
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => console.error('VideoEncoder', e),
      })
      encoder.configure({ codec: VP8_CODEC, width, height, bitrate: EXPORT_BITRATE, framerate: EXPORT_FPS })
      await runEncodeLoop(encoder, exportCanvas, totalFrames, renderFn, onProgress)
      muxer.finalize()
      return new Blob([target.buffer], { type: 'video/webm' })
    }
  }

  // ── MediaRecorder fallback ──────────────────────────────────────────────────
  const mimeType = MediaRecorder.isTypeSupported(EXPORT_FORMAT) ? EXPORT_FORMAT
    : MediaRecorder.isTypeSupported(EXPORT_FALLBACK) ? EXPORT_FALLBACK
    : 'video/webm'

  const stream = exportCanvas.captureStream(0)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: EXPORT_BITRATE })
  const recChunks: BlobPart[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data) }

  return new Promise(resolve => {
    recorder.onstop = () => resolve(new Blob(recChunks, { type: 'video/webm' }))
    recorder.start()

    let frame = 0
    const tick = async () => {
      if (frame > totalFrames) { recorder.stop(); return }
      await renderFn(frame, frame / totalFrames)
      ;(stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }).requestFrame?.()
      onProgress?.(frame / totalFrames)
      frame++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function runEncodeLoop(
  encoder: VideoEncoder,
  exportCanvas: HTMLCanvasElement,
  totalFrames: number,
  renderFn: (frame: number, progress: number) => Promise<void> | void,
  onProgress?: (p: number) => void,
) {
  let framesEncoded = 0
  for (let frame = 0; frame <= totalFrames; frame++) {
    await renderFn(frame, frame / totalFrames)
    const vf = new VideoFrame(exportCanvas, {
      timestamp: frame * FRAME_DURATION_US,
      duration: FRAME_DURATION_US,
    })
    encoder.encode(vf, { keyFrame: frame % EXPORT_FPS === 0 })
    vf.close()
    framesEncoded++
    onProgress?.(frame / totalFrames)
    if (frame % 5 === 0) await new Promise<void>(r => setTimeout(r, 0))
  }
  await encoder.flush()
  if (framesEncoded === 0) throw new Error('VideoEncoder produced no frames — codec may not be supported')
}
