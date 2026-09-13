let audioContext
let masterGain
let enabled = true

function createAudioContext() {
    if (audioContext) return
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    audioContext = new AudioContextClass()
    masterGain = audioContext.createGain()
    masterGain.gain.value = 0.9
    masterGain.connect(audioContext.destination)
}

function playTone(frequency, duration, volume, type = 'triangle', startAt) {
    if (!audioContext || !masterGain || !frequency || !enabled || audioContext.state !== 'running') return
    const start = startAt ?? audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(masterGain)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
}

export async function unlockAudio() {
    if (!enabled) return
    createAudioContext()
    if (!audioContext) return
    if (audioContext.state !== 'running') await audioContext.resume()
}

export async function toggleAllAudio() {
    enabled = !enabled
    createAudioContext()
    if (!audioContext || !masterGain) return enabled

    if (enabled) {
        await audioContext.resume()
        masterGain.gain.cancelScheduledValues(audioContext.currentTime)
        masterGain.gain.setTargetAtTime(0.9, audioContext.currentTime, 0.025)
    } else {
        masterGain.gain.cancelScheduledValues(audioContext.currentTime)
        masterGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.02)
    }
    return enabled
}

export function playHoverSound() {
    if (!audioContext || audioContext.state !== 'running' || !enabled) return
    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(520, now)
    oscillator.frequency.exponentialRampToValueAtTime(690, now + 0.055)
    gain.gain.setValueAtTime(0.018, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)
    oscillator.connect(gain)
    gain.connect(masterGain)
    oscillator.start(now)
    oscillator.stop(now + 0.07)
}

export function playClickSound() {
    if (!audioContext || audioContext.state !== 'running' || !enabled) return
    playTone(220, 0.08, 0.04, 'triangle')
    playTone(330, 0.09, 0.025, 'sine', audioContext.currentTime + 0.035)
}

export function playDigSound() {
    if (!audioContext || !masterGain || audioContext.state !== 'running' || !enabled) return
    const now = audioContext.currentTime

    const bufferLength = Math.floor(audioContext.sampleRate * 0.17)
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < bufferLength; index += 1) {
        const fade = 1 - index / bufferLength
        samples[index] = (Math.random() * 2 - 1) * fade
    }

    const dirtNoise = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const noiseGain = audioContext.createGain()
    dirtNoise.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.value = 560
    filter.Q.value = 0.65
    noiseGain.gain.setValueAtTime(0.34, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    dirtNoise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(masterGain)
    dirtNoise.start(now)

    const impact = audioContext.createOscillator()
    const impactGain = audioContext.createGain()
    impact.type = 'triangle'
    impact.frequency.setValueAtTime(145, now)
    impact.frequency.exponentialRampToValueAtTime(62, now + 0.12)
    impactGain.gain.setValueAtTime(0.24, now)
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
    impact.connect(impactGain)
    impactGain.connect(masterGain)
    impact.start(now)
    impact.stop(now + 0.16)

    playTone(760, 0.07, 0.12, 'triangle', now)
    playTone(430, 0.1, 0.08, 'square', now + 0.025)
}

export function stopAudio() {
    if (audioContext) audioContext.close()
    audioContext = undefined
    masterGain = undefined
}
