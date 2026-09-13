<script setup>
import {computed, onBeforeUnmount, ref} from 'vue'
import {
  playClickSound,
  playDigSound,
  playHoverSound,
  toggleAllAudio,
  unlockAudio,
} from '../audio.js'

const props = defineProps({soundEnabled: Boolean})
const emit = defineEmits(['sound-change', 'back'])

const ROUND_SECONDS = 60
const phase = ref('playing')
const gameStatus = ref('ready')
const showInstructions = ref(false)
const showResetConfirm = ref(false)
const showScorekeeperResult = ref(false)
const showEndConfirm = ref(false)
const countdown = ref(3)
const timeLeft = ref(ROUND_SECONDS)
const workCount = ref(0)
const digPulse = ref(0)
const workerX = ref(45)
const workerY = ref(80)
const lazyCount = ref(0)
const lazyMessage = ref('今天太阳真舒服，先歇一会儿……')
const floatHits = ref([])
const emotion = ref('')
const emotionText = ref('')
let timer
let countdownTimer
let hitId = 0
let lastHoveredButton = null
let resumeAfterInstructions = false
let resumeAfterResetCancel = false
let restartCountdownAfterInstructions = false
let restartCountdownAfterResetCancel = false
let resumeAfterEndCancel = false

const timeProgress = computed(() => ((ROUND_SECONDS - timeLeft.value) / ROUND_SECONDS) * 100)
const workerScale = computed(() => 0.78 + ((workerY.value - 62) / 30) * 0.24)
const recorderLiveMessage = computed(() => {
  if (gameStatus.value === 'ready') return '准备好后点击开始，我会记录今天的工分。'
  if (gameStatus.value === 'countdown') return '全体社员注意，马上开始劳动！'
  if (gameStatus.value === 'paused') return '劳动暂时停下，时间也已经暂停。'
  if (workCount.value >= 60) return '干得真卖力！不过工分要等收工后统一核算。'
  if (workCount.value >= 25) return '大家抓紧干活，争取完成今天的任务！'
  return '大家都要积极参加集体劳动！'
})
const workLevel = computed(() => {
  if (gameStatus.value === 'ready') return '准备就绪'
  if (gameStatus.value === 'countdown') return '即将开始'
  if (gameStatus.value === 'paused') return '已暂停'
  if (workCount.value >= 80) return '拼尽全力'
  if (workCount.value >= 45) return '十分卖力'
  if (workCount.value >= 20) return '渐入佳境'
  return '刚刚开始'
})

const lazyMessages = [
  '干多干少都一样，着什么急？',
  '你多干一点，我也能分到粮食。',
  '反正记分员最后都记10分。',
  '先歇歇吧，最后还是平均分。',
]

function runTimer() {
  window.clearInterval(timer)
  timer = window.setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) finishRound()
  }, 1000)
}

function startRound() {
  if (gameStatus.value === 'running' || gameStatus.value === 'countdown' || gameStatus.value === 'finished') return
  phase.value = 'playing'
  if (gameStatus.value === 'ready') {
    beginCountdown()
    return
  }
  gameStatus.value = 'running'
  runTimer()
}

function beginCountdown() {
  window.clearInterval(countdownTimer)
  countdown.value = 3
  gameStatus.value = 'countdown'
  playClickSound()
  countdownTimer = window.setInterval(() => {
    if (countdown.value > 1) {
      countdown.value -= 1
      playClickSound()
      return
    }
    window.clearInterval(countdownTimer)
    countdownTimer = undefined
    gameStatus.value = 'running'
    runTimer()
  }, 1000)
}

function pauseRound() {
  if (gameStatus.value !== 'running') return
  window.clearInterval(timer)
  timer = undefined
  gameStatus.value = 'paused'
}

function requestReset() {
  resumeAfterResetCancel = gameStatus.value === 'running'
  restartCountdownAfterResetCancel = gameStatus.value === 'countdown'
  if (gameStatus.value === 'running') pauseRound()
  if (gameStatus.value === 'countdown') {
    window.clearInterval(countdownTimer)
    countdownTimer = undefined
    gameStatus.value = 'ready'
  }
  showResetConfirm.value = true
}

function cancelReset() {
  showResetConfirm.value = false
  if (resumeAfterResetCancel) {
    gameStatus.value = 'running'
    runTimer()
  } else if (restartCountdownAfterResetCancel) {
    beginCountdown()
  }
  resumeAfterResetCancel = false
  restartCountdownAfterResetCancel = false
}

function confirmReset() {
  window.clearInterval(timer)
  window.clearInterval(countdownTimer)
  timer = undefined
  countdownTimer = undefined
  phase.value = 'playing'
  gameStatus.value = 'ready'
  timeLeft.value = ROUND_SECONDS
  workCount.value = 0
  digPulse.value = 0
  workerX.value = 45
  workerY.value = 80
  lazyCount.value = 0
  floatHits.value = []
  lazyMessage.value = '今天太阳真舒服，先歇一会儿……'
  emotion.value = ''
  emotionText.value = ''
  showScorekeeperResult.value = false
  showResetConfirm.value = false
  showEndConfirm.value = false
  resumeAfterResetCancel = false
  restartCountdownAfterResetCancel = false
}

function requestEarlyEnd() {
  resumeAfterEndCancel = gameStatus.value === 'running'
  if (gameStatus.value === 'running') pauseRound()
  showEndConfirm.value = true
}

function cancelEarlyEnd() {
  showEndConfirm.value = false
  if (resumeAfterEndCancel) {
    gameStatus.value = 'running'
    runTimer()
  }
  resumeAfterEndCancel = false
}

function confirmEarlyEnd() {
  showEndConfirm.value = false
  resumeAfterEndCancel = false
  finishRound()
}

function openInstructions() {
  resumeAfterInstructions = gameStatus.value === 'running'
  restartCountdownAfterInstructions = gameStatus.value === 'countdown'
  if (resumeAfterInstructions) pauseRound()
  if (gameStatus.value === 'countdown') {
    window.clearInterval(countdownTimer)
    countdownTimer = undefined
    gameStatus.value = 'ready'
  }
  showInstructions.value = true
}

function closeInstructions() {
  showInstructions.value = false
  if (resumeAfterInstructions) startRound()
  else if (restartCountdownAfterInstructions) beginCountdown()
  resumeAfterInstructions = false
  restartCountdownAfterInstructions = false
}

function recordDig(x = 50, y = 55) {
  if (phase.value !== 'playing' || gameStatus.value !== 'running') return
  workerX.value = Math.max(27, Math.min(82, x))
  workerY.value = Math.max(62, Math.min(92, y))
  workCount.value += 1
  digPulse.value += 1
  const id = ++hitId
  floatHits.value.push({id, x: workerX.value, y: Math.max(43, workerY.value - 21)})
  window.setTimeout(() => {
    floatHits.value = floatHits.value.filter((hit) => hit.id !== id)
  }, 650)
  if (workCount.value % 12 === 0) {
    lazyMessage.value = lazyMessages[Math.floor(Math.random() * lazyMessages.length)]
  }
  playDigSound()
}

function dig() {
  recordDig(28 + Math.random() * 53, 64 + Math.random() * 27)
}

function digFromField(event) {
  if (gameStatus.value !== 'running') return
  const rect = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const fieldY = ((event.clientY - rect.top) / rect.height) * 100
  recordDig(x, 62 + fieldY * 0.3)
}

function pokeLazyWorker() {
  if (phase.value !== 'playing' || gameStatus.value !== 'running') return
  lazyCount.value += 1
  lazyMessage.value = lazyMessages[(lazyCount.value - 1) % lazyMessages.length]
}

function finishRound() {
  window.clearInterval(timer)
  timer = undefined
  timeLeft.value = 0
  gameStatus.value = 'finished'
  showScorekeeperResult.value = true
}

function revealDistributionResult() {
  showScorekeeperResult.value = false
  phase.value = 'result'
}

function submitEmotion() {
  if (!emotion.value && !emotionText.value.trim()) return
  phase.value = 'reflection'
}

async function toggleSound() {
  emit('sound-change', await toggleAllAudio())
}

function handlePointerOver(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return
  const button = event.target.closest?.('button')
  if (button && button !== lastHoveredButton) {
    lastHoveredButton = button
    playHoverSound()
  }
}

function handlePointerOut(event) {
  if (!event.relatedTarget?.closest?.('button')) lastHoveredButton = null
}

function handleClick(event) {
  if (event.target.closest?.('button') && !event.target.closest?.('.dig-button')) playClickSound()
}

onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.clearInterval(countdownTimer)
})
</script>

<template>
    <main
      class="collective-page"
      :class="{'game-phase': phase === 'playing'}"
      @pointerdown.capture="unlockAudio"
      @pointerover="handlePointerOver"
      @pointerout="handlePointerOut"
      @click.capture="handleClick"
  >
    <header class="game-header">
      <button class="back-button" type="button" @click="emit('back')">← 返回首页</button>
      <div class="game-title"><div><strong>大锅饭模式</strong><small>人民公社 · 集体劳动</small></div></div>
      <button class="game-sound" type="button" :aria-label="props.soundEnabled ? '关闭游戏音效' : '开启游戏音效'" @click="toggleSound">
        {{ props.soundEnabled ? '🔊' : '🔇' }}
      </button>
    </header>

    <template v-if="phase === 'playing'">
      <section class="status-strip">
        <div class="timer-card" :class="{urgent: timeLeft <= 8}"><span>剩余时间</span><strong>{{ timeLeft }}<small>秒</small></strong></div>
        <div><span>我的劳动</span><strong>{{ workCount }}<small>次</small></strong></div>
        <div><span>劳动状态</span><strong class="status-text">{{ workLevel }}</strong></div>
        <div><span>今日工分</span><strong class="pending">待核算</strong></div>
      </section>

      <div class="progress-track"><span :style="{width: `${timeProgress}%`}"></span></div>

      <section class="work-layout">
        <div class="work-scene" :class="{inactive: gameStatus !== 'running'}">
          <div class="work-sun" aria-hidden="true">
            <span class="sun-eye eye-left"></span><span class="sun-eye eye-right"></span>
            <span class="sun-cheek cheek-left"></span><span class="sun-cheek cheek-right"></span>
            <span class="sun-mouth"></span>
          </div><div class="distant-hills"></div>
          <div class="soil-lines"></div>
          <div class="soil-hit-area" role="button" aria-label="点击土地完成一次锄地" @pointerdown.prevent="digFromField"></div>
          <div class="crop-row row-one" aria-hidden="true">
            <span v-for="n in 7" :key="`grass-${n}`" class="plant grass"><i></i></span>
          </div>
          <div class="crop-row row-two" aria-hidden="true">
            <span v-for="n in 6" :key="`seedling-${n}`" class="plant seedling"><i></i></span>
          </div>
          <div class="crop-row row-three" aria-hidden="true">
            <span v-for="n in 8" :key="`wheat-${n}`" class="plant wheat"><i></i></span>
          </div>

          <div
              class="player-position"
              :style="{left: `${workerX}%`, top: `${workerY}%`, '--worker-scale': workerScale}"
          >
            <div class="player-worker" :key="digPulse">
              <span class="straw-hat"></span>
              <span class="head effort-face">
                <i class="face-eye face-eye-left"></i><i class="face-eye face-eye-right"></i>
                <b class="face-brow face-brow-left"></b><b class="face-brow face-brow-right"></b>
                <em class="effort-mouth"></em>
              </span>
              <span class="body"></span><span class="arm"></span><span class="tool"></span>
              <span v-if="gameStatus === 'running' && workCount > 0" class="sweat sweat-one"></span>
              <span v-if="gameStatus === 'running' && workCount > 0" class="sweat sweat-two"></span>
            </div>
          </div>

          <button class="lazy-worker" type="button" :disabled="gameStatus !== 'running'" @click="pokeLazyWorker">
            <span class="lazy-bubble">{{ lazyMessage }}</span>
            <span class="sleep">Z z</span><span class="lazy-hat"></span>
            <span class="lazy-head">
              <i class="lazy-eye lazy-eye-left"></i><i class="lazy-eye lazy-eye-right"></i><b class="lazy-mouth"></b>
            </span>
            <span class="lazy-body"></span>
          </button>

          <TransitionGroup name="hit">
            <span v-for="hit in floatHits" :key="hit.id" class="float-hit" :style="{left: `${hit.x}%`, top: `${hit.y}%`}">+1 劳动</span>
          </TransitionGroup>

          <Transition name="countdown" mode="out-in">
            <div v-if="gameStatus === 'countdown'" :key="countdown" class="countdown-overlay">
              <span>准备劳动</span>
              <strong>{{ countdown }}</strong>
              <small>倒计时结束后开始计时</small>
            </div>
          </Transition>

          <div class="scene-instruction">
            <strong>{{ gameStatus === 'ready' ? '等待开始游戏' : gameStatus === 'countdown' ? '准备开始' : gameStatus === 'paused' ? '游戏已暂停' : '你正在努力锄地' }}</strong>
            <span>{{ gameStatus === 'running' ? '点击按钮或直接触摸土地完成劳动' : '可以先打开右侧的游戏说明' }}</span>
          </div>
        </div>

        <aside class="work-controls">
          <div class="game-actions">
            <button class="instructions-button" type="button" @click="openInstructions">📜 游戏说明</button>
            <div class="action-row">
              <button class="control-start" type="button" :disabled="gameStatus === 'running' || gameStatus === 'countdown'" @click="startRound">
                {{ gameStatus === 'paused' ? '▶ 继续' : '▶ 开始' }}
              </button>
              <button class="control-pause" type="button" :disabled="gameStatus !== 'running'" @click="pauseRound">Ⅱ 暂停</button>
              <button class="control-replay" type="button" @click="requestReset">↻ 重玩</button>
              <button class="control-end" type="button" :disabled="gameStatus !== 'running' && gameStatus !== 'paused'" @click="requestEarlyEnd">■ 结束</button>
            </div>
          </div>
          <div class="recorder-zone" :class="{talking: gameStatus === 'running'}">
            <div class="recorder-person" aria-hidden="true">
              <span class="recorder-hat"></span>
              <span class="recorder-head">
                <b class="recorder-eye eye-l"></b><b class="recorder-eye eye-r"></b>
                <em class="recorder-brow brow-l"></em><em class="recorder-brow brow-r"></em><i></i>
              </span>
              <span class="recorder-body"></span><span class="recorder-arm"></span>
              <span class="score-book">工分簿</span>
            </div>
            <div class="recorder-speech">
              <span>生产队记分员</span>
              <p>{{ recorderLiveMessage }}</p>
            </div>
          </div>
          <div class="effort-meter"><div><span>我的劳动量</span><b>{{ workCount }}</b></div><div class="meter"><i :style="{width: `${Math.min(workCount, 100)}%`}"></i></div></div>
          <button class="dig-button" type="button" :disabled="gameStatus !== 'running'" @pointerdown.prevent="dig"><span class="hoe-icon">⛏</span><strong>锄 地</strong><small>点击或触摸，努力干活！</small></button>
          <button class="observe-button" type="button" :disabled="gameStatus !== 'running'" @click="pokeLazyWorker">👀 点击看看偷懒的社员</button>
        </aside>
      </section>
    </template>

    <section v-else-if="phase === 'result'" class="result-panel stage-panel">
      <p class="stage-kicker">生产队记分员 · 今日结算</p>
      <h1>收工了，开始记工分！</h1>
      <p class="result-notice">“今天大家干得都差不多，每人记10个工分，粮食统一分配。”</p>

      <div class="comparison-table">
        <div class="person-row table-head"><span>社员</span><span>实际劳动</span><span>所得工分</span><span>分得口粮</span></div>
        <div class="person-row me"><span><i>我</i>努力劳动</span><strong>{{ workCount }}次</strong><b>10分</b><b>100斤</b></div>
        <div class="person-row lazy"><span><i>懒</i>偷懒社员</span><strong>8次</strong><b>10分</b><b>100斤</b></div>
      </div>

      <div class="unfair-callout"><span>!</span><p>你付出了更多劳动，却和偷懒的社员获得了<strong>完全相同</strong>的工分和口粮。</p></div>

      <div class="emotion-box">
        <h2>此刻，你是什么感受？</h2>
        <div class="emotion-options">
          <button v-for="item in ['生气','不公平','失望','不想干了']" :key="item" type="button" :class="{selected: emotion === item}" @click="emotion = item">{{ item }}</button>
        </div>
        <input v-model="emotionText" type="text" maxlength="30" placeholder="也可以写下你的真实感受……" aria-label="输入其他感受">
        <button class="primary-action reflection-action" type="button" :disabled="!emotion && !emotionText.trim()" @click="submitEmotion">提交感受，查看原因 <b>→</b></button>
      </div>
    </section>

    <section v-else class="reflection-panel stage-panel">
      <span class="reflection-seal">思考</span>
      <p class="stage-kicker">第一轮体验完成</p>
      <h1>为什么大家渐渐没有了干劲？</h1>
      <p class="reflection-lead">当劳动多少与个人所得没有直接关系时，努力的人感到不公平，偷懒的人依然能分到同样的粮食。</p>
      <div class="cause-flow">
        <div><span>干多干少一个样</span></div><b>→</b><div><span>劳动积极性下降</span></div><b>→</b><div><span>集体产量难以提高</span></div>
      </div>
      <div class="my-answer">我的感受：<strong>{{ emotion || emotionText }}</strong></div>
      <div class="reflection-buttons">
        <button class="secondary-action" type="button" @click="confirmReset">↻ 重玩本轮</button>
        <button class="primary-action" type="button" @click="emit('back')">完成体验 · 返回首页 <b>→</b></button>
      </div>
    </section>

    <Transition name="instructions">
      <div v-if="showScorekeeperResult" class="instructions-backdrop scorekeeper-backdrop">
        <section class="scorekeeper-dialog" role="alertdialog" aria-modal="true" aria-labelledby="scorekeeper-title">
          <div class="scorekeeper-visual">
            <div class="recorder-person big-recorder" aria-hidden="true">
              <span class="recorder-hat"></span>
              <span class="recorder-head">
                <b class="recorder-eye eye-l"></b><b class="recorder-eye eye-r"></b>
                <em class="recorder-brow brow-l"></em><em class="recorder-brow brow-r"></em><i></i>
              </span>
              <span class="recorder-body"></span><span class="recorder-arm"></span>
              <span class="score-book">工分簿</span>
            </div>
            <div><p class="stage-kicker">生产队记分员</p><h2 id="scorekeeper-title">收工！现在统一记分</h2></div>
          </div>
          <blockquote class="scorekeeper-quote">“今天大家干得都差不多，<br>每人记10个工分，分粮统一分配。”</blockquote>
          <div class="score-summary"><span>你的劳动 <b>{{ workCount }}次</b></span><i>→</i><span>所得工分 <b>10分</b></span></div>
          <button class="primary-action dialog-confirm" type="button" @click="revealDistributionResult">查看分粮结果 <b>→</b></button>
        </section>
      </div>
    </Transition>

    <Transition name="instructions">
      <div v-if="showInstructions" class="instructions-backdrop" @click.self="closeInstructions">
        <section class="instructions-dialog" role="dialog" aria-modal="true" aria-labelledby="instructions-title">
          <button class="instructions-close" type="button" aria-label="关闭游戏说明" @click="closeInstructions">×</button>
          <div class="instructions-heading">
            <div class="stage-number">第一轮</div>
            <div><p class="stage-kicker">生产队通知</p><h2 id="instructions-title">今天，全队一起下地干活！</h2></div>
          </div>
          <p class="instructions-intro">在60秒内点击“锄地”按钮，或者直接点击、触摸农田中的土地，尽可能多地完成劳动。收工后，生产队记分员将统一核算工分和口粮。</p>
          <div class="briefing-rules">
            <div><span>01</span><p><strong>奋力锄地</strong><small>点击按钮或触摸土地，每次计一次劳动</small></p><b>⛏</b></div>
            <div><span>02</span><p><strong>观察社员</strong><small>点击偷懒社员，听听他会说些什么</small></p><b>👀</b></div>
            <div><span>03</span><p><strong>等待分粮</strong><small>劳动结束后，由记分员统一结算</small></p><b>谷</b></div>
          </div>
          <p class="pause-note">{{ resumeAfterInstructions ? '游戏已自动暂停，关闭说明后将继续计时。' : restartCountdownAfterInstructions ? '开始倒计时已暂停，关闭说明后将重新倒计时。' : '游戏尚未开始，阅读完说明后点击“开始”。' }}</p>
          <button class="primary-action dialog-confirm" type="button" @click="closeInstructions">我明白了</button>
        </section>
      </div>
    </Transition>

    <Transition name="instructions">
      <div v-if="showResetConfirm" class="instructions-backdrop reset-backdrop" @click.self="cancelReset">
        <section class="reset-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
          <span class="reset-icon">↻</span>
          <p class="stage-kicker">重新开始本轮</p>
          <h2 id="reset-title">确定要重置吗？</h2>
          <p>劳动会被清空哦，当前的劳动次数和剩余时间将无法恢复。</p>
          <div class="reset-actions">
            <button type="button" @click="cancelReset">取消</button>
            <button class="confirm-reset" type="button" @click="confirmReset">确定重置</button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="instructions">
      <div v-if="showEndConfirm" class="instructions-backdrop reset-backdrop" @click.self="cancelEarlyEnd">
        <section class="reset-dialog end-dialog" role="alertdialog" aria-modal="true" aria-labelledby="end-title">
          <span class="reset-icon">■</span>
          <p class="stage-kicker">提前结束劳动</p>
          <h2 id="end-title">确定要提前结束吗？</h2>
          <p>结束后将立即进入本轮结算，不能继续劳动。</p>
          <div class="reset-actions">
            <button type="button" @click="cancelEarlyEnd">继续劳动</button>
            <button class="confirm-end" type="button" @click="confirmEarlyEnd">确定结束</button>
          </div>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.collective-page { min-height:100vh; min-height:100svh; color:#29251d; background:radial-gradient(circle at 20% 10%,rgba(229,190,102,.15),transparent 30%),#eee5d1; }
.game-header { height:78px; padding:0 max(28px,calc((100vw - 1220px)/2)); display:grid; grid-template-columns:1fr auto 1fr; align-items:center; border-bottom:1px solid rgba(91,65,34,.22); background:rgba(250,245,230,.75); }
.back-button { justify-self:start; padding:9px 13px; color:#6d6251; cursor:pointer; border:1px solid rgba(91,65,34,.2); background:transparent; }
.game-title { display:flex; align-items:center; gap:11px; }
.game-title>span { width:42px; height:42px; display:grid; place-items:center; color:#f9edcf; font-weight:900; border-radius:50%; background:#9f3828; }
.game-title div { display:flex; flex-direction:column; }.game-title strong { font:900 19px/1.2 "STSong","SimSun",serif; letter-spacing:.12em; }.game-title small { margin-top:3px; color:#7b705e; font-size:9px; letter-spacing:.2em; }
.game-sound { justify-self:end; width:42px; height:42px; cursor:pointer; border:1px solid rgba(91,65,34,.25); border-radius:50%; background:#f7eed9; font-size:19px; }
.stage-panel { width:min(980px,calc(100% - 64px)); margin:0 auto; padding:clamp(42px,7vh,75px) 0; text-align:center; }
.stage-number { flex:0 0 auto; width:68px; height:68px; display:grid; place-items:center; color:#faedce; font:900 16px serif; border:5px double #e1bb70; border-radius:50%; background:#9f3828; }
.stage-kicker { margin:0 0 9px; color:#a23a29; font-size:12px; font-weight:900; letter-spacing:.25em; }
.stage-panel h1 { margin:0; font:900 clamp(32px,4vw,48px)/1.3 "STSong","SimSun",serif; }
.stage-intro { max-width:690px; margin:18px auto 0; color:#655c4e; font-size:16px; line-height:1.9; }
.briefing-panel {
  width:min(1100px,calc(100% - 64px)); min-height:0; margin:auto; padding:28px;
  display:grid; grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr); gap:36px;
  text-align:left; border:1px solid rgba(102,73,37,.22);
  background:linear-gradient(120deg,rgba(255,251,239,.68),rgba(241,228,198,.5));
  box-shadow:0 18px 45px rgba(72,51,25,.09);
}
.briefing-copy { padding:10px 4px 8px 8px; display:flex; flex-direction:column; }
.briefing-heading { display:flex; align-items:center; gap:18px; }
.briefing-heading .stage-kicker { margin-bottom:4px; }
.briefing-heading h1 { font-size:clamp(31px,3vw,43px); line-height:1.22; }
.briefing-panel .stage-intro { margin:22px 0 0; font-size:14px; line-height:1.8; }
.briefing-cta { margin-top:auto; padding-top:24px; }
.briefing-guide { padding:20px 22px; border-left:4px solid #a33b2b; background:rgba(255,250,236,.72); }
.guide-title { padding-bottom:12px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(102,73,37,.17); }
.guide-title span { color:#943426; font:900 17px serif; letter-spacing:.12em; }
.guide-title small { color:#a99a82; font:700 9px Georgia; letter-spacing:.2em; }
.briefing-rules { display:grid; grid-template-columns:1fr; }
.briefing-rules>div { position:relative; min-height:75px; padding:13px 45px 12px 55px; display:flex; align-items:center; border-bottom:1px solid rgba(102,73,37,.14); }
.briefing-rules>div>span { position:absolute; left:0; color:rgba(154,59,42,.27); font:900 25px Georgia; }
.briefing-rules p { margin:0; display:flex; flex-direction:column; }
.briefing-rules strong { color:#342e25; font-family:serif; font-size:17px; }
.briefing-rules small { margin-top:4px; color:#817561; font-size:11px; }
.briefing-rules>div>b { position:absolute; right:2px; color:#806b48; font-size:22px; }
.guide-note { margin:13px 0 0; color:#796e5d; font-size:11px; }
.guide-note i { width:18px; height:18px; margin-right:5px; display:inline-grid; place-items:center; color:#f7e9c9; font-style:normal; font-weight:900; border-radius:50%; background:#9d3a2b; }
.primary-action { min-width:310px; padding:16px 23px; color:#fff3d6; font-weight:900; cursor:pointer; border:0; border-radius:3px; background:linear-gradient(135deg,#ad422e,#842a20); box-shadow:0 11px 23px rgba(116,39,28,.2); }.primary-action b{margin-left:20px;font-size:18px}.primary-action:disabled{opacity:.45;cursor:not-allowed}.briefing-tip{margin:11px 0 0 4px;color:#897d6a;font-size:11px}
.status-strip { width:min(1220px,calc(100% - 56px)); margin:19px auto 0; display:grid; grid-template-columns:repeat(4,1fr); border:1px solid rgba(92,68,37,.22); background:rgba(251,247,234,.7); }
.status-strip>div { min-height:65px; padding:10px 20px; display:flex; align-items:center; justify-content:space-between; border-right:1px solid rgba(92,68,37,.16); }.status-strip span{color:#756b59;font-size:11px}.status-strip strong{font:900 26px Georgia,serif}.status-strip small{margin-left:3px;font:500 11px sans-serif}.status-strip .status-text{color:#586947;font:900 17px serif}.status-strip .pending{color:#9c392a;font:900 17px serif}.status-strip .round-mark{padding:7px;flex-direction:column;justify-content:center;color:#f7e9c8;background:#973728;font:900 11px serif}.round-mark b{font-size:20px}.timer-card.urgent strong{color:#b33426;animation:pulse .65s infinite alternate}
.progress-track { width:min(1220px,calc(100% - 56px)); height:5px; margin:0 auto 18px; overflow:hidden; background:#d5c9af; }.progress-track span{display:block;height:100%;background:#a6402d;transition:width 1s linear}
.work-layout { width:min(1220px,calc(100% - 56px)); margin:0 auto; display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:22px; }
.work-scene { position:relative; min-height:545px; overflow:hidden; border:7px solid #f4ead4; outline:1px solid rgba(90,63,33,.25); background:linear-gradient(#e6b45c 0 38%,#83884f 38% 48%,#6f6038 48%); box-shadow:0 17px 38px rgba(61,45,23,.15); }
.work-scene.inactive::after{content:"";position:absolute;z-index:6;inset:0;pointer-events:none;background:rgba(66,55,36,.08)}
.work-sun{position:absolute;top:38px;right:12%;width:78px;height:78px;border-radius:50%;background:#bc4b2e;box-shadow:0 0 0 16px rgba(202,87,41,.1)}.distant-hills{position:absolute;left:-5%;right:-5%;top:25%;height:30%;background:#657345;clip-path:polygon(0 75%,15% 40%,29% 65%,45% 15%,61% 61%,76% 31%,100% 72%,100% 100%,0 100%)}
.soil-lines{position:absolute;inset:47% -10% -15%;background:repeating-linear-gradient(105deg,transparent 0,transparent 63px,rgba(45,44,26,.45) 66px,rgba(45,44,26,.45) 82px)}.soil-hit-area{position:absolute;z-index:5;inset:47% 0 0;cursor:crosshair;touch-action:manipulation}.crop-row{position:absolute;color:#d0b85e;font-size:28px;letter-spacing:22px;transform:rotate(-2deg)}.row-one{left:4%;bottom:33px}.row-two{right:-5%;bottom:113px;transform:scale(.7) rotate(-3deg)}
.player-position{position:absolute;z-index:6;width:100px;height:170px;pointer-events:none;transform:translate(-50%,-58%) scale(var(--worker-scale));transform-origin:center bottom;transition:left .28s ease,top .28s ease,transform .28s ease}.player-worker{position:relative;width:100px;height:170px;animation:workSwing .2s ease}.player-worker .head{position:absolute;top:29px;left:41px;width:30px;height:34px;border-radius:45%;background:#a96c43}.straw-hat{position:absolute;z-index:2;top:17px;left:24px;width:65px;height:14px;border-radius:50%;background:#c9a147}.straw-hat::after{content:"";position:absolute;left:17px;bottom:6px;width:32px;height:24px;border-radius:50% 50% 0 0;background:#b48c38}.player-worker .body{position:absolute;top:61px;left:28px;width:52px;height:72px;border-radius:10px 10px 3px 3px;background:#435668}.player-worker .body::after,.player-worker .body::before{content:"";position:absolute;bottom:-39px;width:15px;height:45px;background:#303a38}.player-worker .body::before{left:8px;transform:rotate(7deg)}.player-worker .body::after{right:7px;transform:rotate(-7deg)}.arm{position:absolute;z-index:2;top:71px;left:68px;width:60px;height:12px;border-radius:9px;background:#a96c43;transform:rotate(30deg)}.tool{position:absolute;z-index:1;top:70px;left:112px;width:5px;height:120px;background:#59402b;transform:rotate(-35deg);transform-origin:top}.tool::after{content:"";position:absolute;bottom:0;width:29px;height:9px;background:#33342d}
.lazy-worker{position:absolute;z-index:7;left:8%;bottom:78px;width:150px;height:145px;padding:0;cursor:pointer;border:0;background:transparent}.lazy-head{position:absolute;top:52px;left:61px;width:29px;height:29px;border-radius:50%;background:#9f6845}.lazy-hat{position:absolute;z-index:2;top:43px;left:48px;width:56px;height:12px;border-radius:50%;background:#b89843}.lazy-body{position:absolute;top:78px;left:43px;width:67px;height:38px;border-radius:30px 30px 5px 5px;background:#6a5a4a;transform:rotate(8deg)}.sleep{position:absolute;top:13px;right:7px;color:#f3e5b7;font:bold 18px Georgia;transform:rotate(-10deg)}.lazy-bubble{position:absolute;left:-15px;bottom:135px;width:184px;padding:10px;color:#f8edcf;font-size:11px;line-height:1.45;border-radius:4px;background:#3f4936;filter:drop-shadow(0 5px 8px rgba(40,36,22,.22))}.lazy-bubble::after{content:"";position:absolute;bottom:-8px;left:78px;border:8px solid transparent;border-top-color:#3f4936;border-bottom:0}
.float-hit{position:absolute;z-index:8;color:#fff1bf;font-weight:900;text-shadow:0 2px 4px rgba(47,35,19,.6);pointer-events:none;animation:floatUp .65s ease-out forwards}.scene-instruction{position:absolute;z-index:9;left:50%;bottom:18px;padding:10px 18px;display:flex;flex-direction:column;text-align:center;color:#f7edcf;background:rgba(51,59,43,.86);pointer-events:none;transform:translateX(-50%)}.scene-instruction strong{font-family:serif}.scene-instruction span{margin-top:2px;font-size:10px;opacity:.75}
.countdown-overlay{position:absolute;z-index:15;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff1ce;background:rgba(48,43,29,.66);backdrop-filter:blur(2px);pointer-events:none}.countdown-overlay>span{font-size:13px;font-weight:900;letter-spacing:.3em}.countdown-overlay>strong{margin:3px 0;font:900 clamp(90px,13vw,150px)/1 Georgia,serif;text-shadow:0 8px 25px rgba(20,16,10,.35)}.countdown-overlay>small{font-size:12px;letter-spacing:.1em;opacity:.82}.countdown-enter-active,.countdown-leave-active{transition:opacity .16s ease,transform .16s ease}.countdown-enter-from{opacity:0;transform:scale(1.16)}.countdown-leave-to{opacity:0;transform:scale(.86)}
.work-controls{display:flex;flex-direction:column;gap:12px}.game-actions{padding:12px;border:1px solid rgba(91,68,38,.2);background:rgba(255,250,237,.68)}.instructions-button{width:100%;padding:10px;color:#704034;font-weight:900;cursor:pointer;border:1px dashed rgba(151,55,41,.4);background:#f4e5c9}.action-row{margin-top:9px;display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:7px}.action-row button{padding:10px 5px;color:#635a4a;font-size:12px;font-weight:800;cursor:pointer;border:1px solid rgba(91,68,38,.24);background:#f9f1df}.action-row .control-start{color:#fff0ce;border-color:#923426;background:#a33b2a}.action-row button:disabled{opacity:.4;cursor:not-allowed}.notice-card{padding:15px 17px;border-left:4px solid #a73f2d;background:#f9f0dc}.notice-card span{color:#a43b2b;font-size:11px;font-weight:900;letter-spacing:.18em}.notice-card p{margin:6px 0 0;color:#5f5546;font-size:12px;line-height:1.55}.effort-meter{padding:14px 17px;background:rgba(255,250,237,.6);border:1px solid rgba(91,68,38,.2)}.effort-meter>div{display:flex;justify-content:space-between;color:#746957;font-size:12px}.effort-meter b{color:#9f392a;font:900 22px Georgia}.meter{height:7px;margin-top:8px;overflow:hidden;background:#d5c8ac}.meter i{display:block;height:100%;background:#a43b29;transition:width .12s}
.dig-button{min-height:190px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff1cc;cursor:pointer;border:0;border-radius:5px;background:radial-gradient(circle at 50% 35%,#bb5238,#8e2f24 70%);box-shadow:0 12px 25px rgba(104,37,28,.23),inset 0 0 0 5px rgba(255,237,196,.1);touch-action:manipulation;user-select:none}.dig-button:active{transform:scale(.975)}.hoe-icon{font-size:48px;filter:sepia(1)}.dig-button strong{margin-top:5px;font:900 29px serif;letter-spacing:.3em}.dig-button small{margin-top:7px;opacity:.8}.observe-button{padding:13px;color:#4b5740;cursor:pointer;border:1px solid rgba(63,83,52,.3);background:#e6e3c4}
.result-panel{padding-top:38px}.result-notice{max-width:720px;margin:17px auto 24px;padding:14px 20px;color:#f6e9c8;font-family:serif;background:#3f4935}.comparison-table{border:1px solid rgba(96,70,38,.23);background:rgba(255,251,238,.65)}.person-row{display:grid;grid-template-columns:1.4fr repeat(3,1fr);align-items:center;min-height:65px;border-top:1px solid rgba(96,70,38,.16)}.person-row:first-child{border:0}.person-row>*{padding:10px;border-right:1px solid rgba(96,70,38,.14)}.person-row>*:last-child{border:0}.table-head{min-height:38px;color:#786c58;font-size:11px;font-weight:800;background:#ded2b7}.person-row span{display:flex;align-items:center;gap:9px}.person-row i{width:32px;height:32px;display:grid;place-items:center;color:white;font-style:normal;font-weight:900;border-radius:50%;background:#a03a2a}.person-row.lazy i{background:#6b6755}.person-row strong{font:900 22px Georgia}.person-row b{color:#9f392a;font-size:18px}.unfair-callout{margin:18px 0;padding:13px 18px;display:flex;align-items:center;justify-content:center;gap:10px;color:#743124;border:1px dashed rgba(157,57,41,.45);background:rgba(239,207,164,.45)}.unfair-callout>span{width:24px;height:24px;display:grid;place-items:center;color:white;border-radius:50%;background:#a13a29}.unfair-callout p{margin:0;font-size:13px}.emotion-box h2{margin:19px 0 12px;font:900 20px serif}.emotion-options{display:flex;justify-content:center;gap:10px}.emotion-options button{min-width:100px;padding:10px 15px;color:#615846;cursor:pointer;border:1px solid rgba(93,69,37,.25);background:#f8f0de}.emotion-options button.selected{color:#fff1d3;border-color:#913125;background:#a03a29}.emotion-box input{width:min(500px,100%);margin-top:12px;padding:12px 14px;border:1px solid rgba(93,69,37,.25);background:#fffaf0;font:inherit}.reflection-action{display:block;margin:15px auto 0;padding-block:13px}
.reflection-panel{padding-top:55px}.reflection-seal{width:70px;height:70px;margin:0 auto 17px;display:grid;place-items:center;color:#f4e4b9;font:900 17px serif;border:5px double #d8b56f;border-radius:50%;background:#43523b}.reflection-lead{max-width:740px;margin:18px auto 0;color:#655b4d;font-size:16px;line-height:1.9}.cause-flow{margin:37px 0;display:flex;align-items:center;justify-content:center;gap:16px}.cause-flow div{min-width:190px;padding:20px 16px;color:#633226;font-weight:900;border:1px solid rgba(139,54,39,.25);background:#f1dcc0}.cause-flow b{color:#9e3a2b;font-size:24px}.my-answer{margin:0 auto 28px;color:#756b58}.my-answer strong{color:#9d3829}
.reflection-buttons{display:flex;align-items:center;justify-content:center;gap:12px}.secondary-action{padding:15px 22px;color:#714337;font-weight:900;cursor:pointer;border:1px solid rgba(145,52,39,.4);background:#f6ead2}
.instructions-backdrop{position:fixed;z-index:40;inset:0;padding:28px;display:grid;place-items:center;background:rgba(38,31,21,.72);backdrop-filter:blur(5px)}
.instructions-dialog{position:relative;width:min(780px,100%);max-height:calc(100svh - 56px);overflow:auto;padding:31px 38px 27px;border:1px solid rgba(102,73,37,.36);background:#f8f0de;box-shadow:0 30px 75px rgba(26,21,14,.45)}
.instructions-dialog::before{content:"";position:absolute;inset:8px;pointer-events:none;border:1px solid rgba(102,73,37,.14)}
.instructions-close{position:absolute;z-index:2;top:15px;right:16px;width:35px;height:35px;padding:0;color:#756956;cursor:pointer;border:1px solid rgba(91,68,38,.22);border-radius:50%;background:transparent;font:300 27px/1 serif}
.instructions-heading{display:flex;align-items:center;gap:17px;padding-right:42px}.instructions-heading .stage-kicker{margin-bottom:4px}.instructions-heading h2{margin:0;font:900 clamp(25px,3vw,35px)/1.3 "STSong","SimSun",serif}.instructions-intro{margin:18px 0;color:#62594a;font-size:14px;line-height:1.75}
.instructions-dialog .briefing-rules{border-top:1px solid rgba(102,73,37,.16)}.pause-note{margin:15px 0 0;padding:9px;color:#84372b;font-size:12px;text-align:center;background:rgba(232,202,154,.35)}.dialog-confirm{display:block;min-width:220px;margin:16px auto 0;padding-block:13px}
.reset-backdrop{z-index:50}.reset-dialog{position:relative;width:min(440px,100%);padding:33px 38px 30px;text-align:center;border:1px solid rgba(102,73,37,.36);background:#f8f0de;box-shadow:0 30px 75px rgba(26,21,14,.45)}.reset-dialog::before{content:"";position:absolute;inset:8px;pointer-events:none;border:1px solid rgba(102,73,37,.14)}.reset-icon{width:58px;height:58px;margin:0 auto 14px;display:grid;place-items:center;color:#f7e9c9;font-size:28px;border-radius:50%;background:#a13b2b}.reset-dialog h2{margin:0;font:900 29px/1.3 "STSong","SimSun",serif}.reset-dialog>p:not(.stage-kicker){margin:13px auto 0;color:#6f6453;font-size:13px;line-height:1.7}.reset-actions{margin-top:23px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.reset-actions button{padding:12px;cursor:pointer;color:#655b4b;font-weight:900;border:1px solid rgba(91,68,38,.25);background:#f9f1df}.reset-actions .confirm-reset{color:#fff0d1;border-color:#923426;background:#a23a2a}
.instructions-enter-active,.instructions-leave-active{transition:opacity .18s ease}.instructions-enter-active .instructions-dialog,.instructions-leave-active .instructions-dialog{transition:transform .2s ease}.instructions-enter-from,.instructions-leave-to{opacity:0}.instructions-enter-from .instructions-dialog,.instructions-leave-to .instructions-dialog{transform:translateY(14px) scale(.98)}
@keyframes workSwing{0%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}100%{transform:rotate(0)}}@keyframes floatUp{from{opacity:1;transform:translate(-50%,0)}to{opacity:0;transform:translate(-50%,-70px)}}@keyframes pulse{to{transform:scale(1.08)}}
@media(max-width:1000px){.game-header{padding-inline:22px}.status-strip,.progress-track,.work-layout{width:calc(100% - 36px)}.work-layout{grid-template-columns:minmax(0,1fr) 260px}.work-scene{min-height:500px}.game-title small{display:none}.status-strip>div{padding-inline:12px}.status-strip .status-text,.status-strip .pending{font-size:14px}.dig-button{min-height:165px}.cause-flow{gap:8px}.cause-flow div{min-width:170px}}
@media(max-width:700px){.work-layout{grid-template-columns:1fr}.work-scene{min-height:440px}.work-controls{display:grid;grid-template-columns:1fr 1fr}.dig-button{grid-row:1/3;grid-column:2;min-height:190px}.status-strip{grid-template-columns:repeat(4,1fr)}.status-strip>div{padding:8px;flex-direction:column;justify-content:center}.status-strip strong{font-size:22px}.briefing-rules{margin-top:28px}.mode-options{grid-template-columns:1fr}.cause-flow div{min-width:0;flex:1}.stage-panel{width:calc(100% - 42px)}}
@media(max-width:920px){
  .briefing-panel{width:calc(100% - 42px);margin:24px auto;padding:22px;grid-template-columns:1fr;gap:20px}
  .briefing-copy{padding:0}.briefing-heading h1{font-size:34px}.briefing-panel .stage-intro{margin-top:16px}
  .briefing-cta{padding-top:18px}.briefing-guide{padding:15px 20px}.briefing-rules{margin-top:0}
  .briefing-rules>div{min-height:64px;padding-block:9px}
}
@media(max-height:650px) and (min-width:921px){
  .game-header{height:64px}.briefing-panel{padding:20px 24px;gap:28px}
  .stage-number{width:58px;height:58px;font-size:14px}.briefing-heading h1{font-size:34px}
  .briefing-panel .stage-intro{margin-top:14px;line-height:1.65}.briefing-cta{padding-top:15px}
  .briefing-guide{padding:13px 18px}.briefing-rules>div{min-height:62px;padding-block:8px}
  .primary-action{padding-block:13px}.guide-note{margin-top:9px}
}
.player-position{transform:translate(-50%,-100%) scale(var(--worker-scale))}
.progress-track span{background:linear-gradient(90deg,#708c4b,#3f6d3a)}
.work-sun{animation:sunFloat 4s ease-in-out infinite,sunGlow 2.8s ease-in-out infinite alternate}
.work-sun::before{content:"";position:absolute;inset:-14px;border:2px solid rgba(196,79,42,.22);border-radius:50%;animation:sunRing 2.8s ease-out infinite}
.work-sun::after{content:"";position:absolute;inset:-23px;border:2px dashed rgba(222,145,64,.28);border-radius:50%;animation:sunRotate 15s linear infinite}
.sweat{position:absolute;z-index:5;width:7px;height:12px;border-radius:70% 30% 65% 35%;background:#bfe8ec;box-shadow:0 1px 2px rgba(39,75,75,.3);animation:sweatDrop .62s ease-out forwards}
.sweat-one{top:42px;left:76px;transform:rotate(22deg)}
.sweat-two{top:51px;left:86px;animation-delay:.08s;transform:scale(.75) rotate(25deg)}
@keyframes sunFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes sunGlow{from{box-shadow:0 0 0 12px rgba(202,87,41,.09),0 0 20px rgba(202,87,41,.13)}to{box-shadow:0 0 0 23px rgba(202,87,41,.13),0 0 45px rgba(202,87,41,.26)}}
@keyframes sunRing{0%{opacity:.7;transform:scale(.82)}100%{opacity:0;transform:scale(1.2)}}
@keyframes sunRotate{to{transform:rotate(360deg)}}
@keyframes sweatDrop{0%{opacity:0;transform:translate(0,-4px) scale(.55) rotate(22deg)}30%{opacity:1}100%{opacity:0;transform:translate(14px,23px) scale(1) rotate(22deg)}}
.crop-row{z-index:3;display:flex;align-items:flex-end;justify-content:space-around;height:58px;color:inherit;font-size:initial;letter-spacing:0;pointer-events:none;transform:none}
.crop-row.row-one{left:2%;right:1%;bottom:17px}
.crop-row.row-two{left:12%;right:2%;bottom:112px;transform:scale(.82);transform-origin:center bottom}
.crop-row.row-three{left:27%;right:4%;bottom:203px;height:42px;transform:scale(.62);transform-origin:center bottom}
.plant{position:relative;display:block;flex:0 0 28px;width:28px;height:45px;transform-origin:center bottom;animation:cropSway 2.8s ease-in-out infinite alternate}
.plant:nth-child(2n){height:38px;animation-delay:-1.1s}.plant:nth-child(3n){height:50px;animation-delay:-2s}
.grass i{position:absolute;bottom:0;left:13px;width:3px;height:31px;border-radius:4px 4px 0 0;background:#4d7837}
.grass i::before,.grass i::after{content:"";position:absolute;bottom:0;width:13px;height:26px}
.grass i::before{left:-11px;border-right:3px solid #638b42;border-radius:0 100% 0 0;transform:rotate(-15deg)}
.grass i::after{right:-10px;border-left:3px solid #3f6d32;border-radius:100% 0 0;transform:rotate(17deg)}
.grass::before,.grass::after{content:"";position:absolute;bottom:0;width:3px;height:22px;border-radius:4px 4px 0 0;background:#76954b}
.grass::before{left:8px;transform:rotate(-29deg)}.grass::after{right:7px;transform:rotate(30deg)}
.seedling i{position:absolute;bottom:0;left:13px;width:3px;height:34px;background:#4e7436}
.seedling i::before,.seedling i::after{content:"";position:absolute;width:14px;height:9px;background:#668b43}
.seedling i::before{left:-13px;top:9px;border-radius:100% 0 100% 0;transform:rotate(12deg)}
.seedling i::after{left:2px;top:17px;border-radius:0 100% 0 100%;background:#426b34;transform:rotate(-8deg)}
.seedling::after{content:"";position:absolute;bottom:-2px;left:5px;width:19px;height:5px;border-radius:50%;background:rgba(51,46,27,.35)}
.wheat i{position:absolute;bottom:0;left:13px;width:3px;height:38px;background:#ad913e}
.wheat i::before{content:"";position:absolute;left:-3px;top:-7px;width:9px;height:18px;border-radius:55%;background:repeating-linear-gradient(0deg,#d4b95e 0 3px,#9c8135 3px 4px);transform:rotate(-7deg)}
.wheat i::after{content:"";position:absolute;left:2px;top:17px;width:12px;height:7px;border-radius:0 100% 0 100%;background:#b89c45;transform:rotate(-15deg)}
@keyframes cropSway{from{transform:rotate(-3deg)}to{transform:rotate(4deg)}}
.work-sun::after{inset:-38px;border:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(244,190,82,.62) 0deg 3deg,transparent 3deg 45deg);-webkit-mask:radial-gradient(circle,transparent 0 43%,#000 45% 100%);mask:radial-gradient(circle,transparent 0 43%,#000 45% 100%);animation:heatRays 2.2s ease-in-out infinite alternate}
.recorder-zone{min-height:112px;padding:10px 11px;display:grid;grid-template-columns:82px 1fr;gap:8px;align-items:center;border:1px solid rgba(91,68,38,.2);border-left:4px solid #a73f2d;background:#f9f0dc}
.recorder-person{position:relative;width:78px;height:96px}
.recorder-hat{position:absolute;z-index:3;top:5px;left:15px;width:49px;height:12px;border-radius:50%;background:#4b633d}.recorder-hat::after{content:"";position:absolute;left:10px;bottom:5px;width:29px;height:19px;border-radius:50% 50% 0 0;background:#587148}
.recorder-head{position:absolute;z-index:2;top:14px;left:25px;width:29px;height:31px;border-radius:45%;background:#a96e48}.recorder-head i{position:absolute;right:2px;bottom:7px;width:7px;height:3px;border-radius:0 0 6px 6px;background:#642e25}
.recorder-body{position:absolute;top:43px;left:15px;width:47px;height:47px;border-radius:9px 9px 3px 3px;background:#53615a}.recorder-body::before{content:"";position:absolute;bottom:-6px;left:5px;width:37px;height:9px;background:#3f4944}
.recorder-arm{position:absolute;z-index:4;top:55px;left:49px;width:29px;height:9px;border-radius:8px;background:#a96e48;transform:rotate(25deg)}
.score-book{position:absolute;z-index:5;right:-3px;bottom:9px;width:38px;height:29px;padding-top:8px;color:#f7e8c7;font-size:8px;font-weight:900;text-align:center;border-left:3px solid #713326;border-radius:2px;background:#9d3a2c;transform:rotate(-7deg)}
.recorder-speech{position:relative;padding:9px 9px 9px 12px;color:#f7ecd0;border-radius:3px;background:#3f4937}.recorder-speech::before{content:"";position:absolute;left:-8px;top:29px;border:8px solid transparent;border-left:0;border-right-color:#3f4937}.recorder-speech>span{color:#e8c971;font-size:9px;font-weight:900;letter-spacing:.12em}.recorder-speech p{margin:4px 0 0;font-size:10px;line-height:1.55}
.recorder-zone.talking .recorder-head i{animation:recorderTalk .38s steps(2,end) infinite}
.scorekeeper-backdrop{z-index:45}.scorekeeper-dialog{position:relative;width:min(640px,100%);padding:32px 42px 29px;text-align:center;border:1px solid rgba(102,73,37,.38);background:#f8f0de;box-shadow:0 30px 80px rgba(26,21,14,.48)}.scorekeeper-dialog::before{content:"";position:absolute;inset:8px;pointer-events:none;border:1px solid rgba(102,73,37,.15)}
.scorekeeper-visual{display:flex;align-items:center;justify-content:center;gap:28px;text-align:left}.big-recorder{flex:0 0 78px;transform:scale(1.15);transform-origin:center}.scorekeeper-visual .stage-kicker{margin-bottom:5px}.scorekeeper-visual h2{margin:0;font:900 clamp(25px,3vw,34px)/1.3 "STSong","SimSun",serif}
.scorekeeper-quote{position:relative;width:100%;margin:24px 0 17px;padding:18px 22px;color:#f8edcf;font:900 18px/1.75 "STSong","SimSun",serif;text-align:center;border:0;background:#3f4936;box-shadow:none}.scorekeeper-quote::before{content:"喊";position:absolute;left:13px;top:13px;width:30px;height:30px;display:grid;place-items:center;color:#6c3427;font-size:12px;border-radius:50%;background:#e4c572}
.score-summary{display:flex;align-items:center;justify-content:center;gap:21px;color:#6d6251;font-size:13px}.score-summary span{padding:10px 16px;border:1px solid rgba(96,70,38,.2);background:#f4e5c9}.score-summary b{margin-left:7px;color:#a13929;font-size:17px}.score-summary i{color:#9c392a;font-style:normal;font-size:20px}
@keyframes heatRays{from{opacity:.48;transform:scale(.88) rotate(-2deg)}to{opacity:1;transform:scale(1.08) rotate(2deg)}}
@keyframes recorderTalk{0%{height:2px;transform:scaleX(1)}100%{height:6px;transform:scaleX(.7)}}
.work-sun{z-index:1;isolation:isolate}
.sun-eye{position:absolute;z-index:3;top:27px;width:8px;height:11px;border-radius:50%;background:#5c2e25;box-shadow:inset 2px 1px 0 rgba(255,255,255,.28);animation:sunBlink 4.2s ease-in-out infinite}
.eye-left{left:21px}.eye-right{right:21px;animation-delay:.08s}
.sun-cheek{position:absolute;z-index:3;top:44px;width:12px;height:6px;border-radius:50%;background:rgba(137,38,31,.35)}
.cheek-left{left:10px}.cheek-right{right:10px}
.sun-mouth{position:absolute;z-index:3;left:50%;top:41px;width:19px;height:12px;border-bottom:3px solid #692f25;border-radius:0 0 50% 50%;transform:translateX(-50%);animation:sunSmile 2.8s ease-in-out infinite alternate}
@keyframes sunBlink{0%,44%,50%,100%{transform:scaleY(1)}47%{transform:scaleY(.08)}}
@keyframes sunSmile{from{transform:translateX(-50%) scaleX(.86)}to{transform:translateX(-50%) scaleX(1.08)}}
.dig-button:disabled,.observe-button:disabled{opacity:.48;cursor:not-allowed;filter:grayscale(.45);box-shadow:none}
.dig-button:disabled:active{transform:none}
.lazy-worker:disabled{cursor:not-allowed;filter:saturate(.72)}
.work-scene.inactive .soil-hit-area{cursor:not-allowed}
.action-row{grid-template-columns:repeat(4,1fr)}
.action-row .control-start{color:#f6f2d7;border-color:#426737;background:#4f783f}
.action-row .control-pause{color:#3f321d;border-color:#c89431;background:#e2b957}
.action-row .control-replay{color:#eef6fb;border-color:#356886;background:#477e9f}
.action-row .control-end{color:#fff0da;border-color:#933327;background:#a83e30}
.end-dialog .reset-icon{background:#a83e30}.reset-actions .confirm-end{color:#fff0da;border-color:#933327;background:#a83e30}
.effort-face .face-eye{position:absolute;z-index:2;top:13px;width:4px;height:5px;border-radius:50%;background:#492b24}.effort-face .face-eye-left{left:7px}.effort-face .face-eye-right{right:7px}
.effort-face .face-brow{position:absolute;z-index:2;top:8px;width:9px;height:2px;border-radius:2px;background:#593027}.effort-face .face-brow-left{left:4px;transform:rotate(18deg)}.effort-face .face-brow-right{right:4px;transform:rotate(-18deg)}
.effort-mouth{position:absolute;z-index:2;left:50%;bottom:6px;width:12px;height:5px;border:2px solid #69352b;border-top:0;border-radius:0 0 9px 9px;transform:translateX(-50%) rotate(180deg)}
.effort-mouth::after{content:"";position:absolute;left:2px;right:2px;top:1px;height:1px;background:rgba(255,235,204,.7)}
.lazy-eye{position:absolute;z-index:3;top:10px;width:8px;height:4px;border-bottom:2px solid #513027;border-radius:0 0 50% 50%}.lazy-eye-left{left:5px}.lazy-eye-right{right:5px}
.lazy-mouth{position:absolute;z-index:3;left:50%;bottom:4px;width:8px;height:9px;border-radius:50%;background:#66342c;transform:translateX(-50%);animation:lazyYawn 2.6s ease-in-out infinite}
.lazy-head::after{content:"";position:absolute;z-index:2;left:2px;right:2px;top:17px;height:4px;border-radius:50%;background:linear-gradient(90deg,rgba(156,60,48,.28) 0 24%,transparent 24% 76%,rgba(156,60,48,.28) 76%)}
.recorder-head .recorder-eye{position:absolute;z-index:3;top:12px;width:4px;height:5px;border-radius:50%;background:#402821}.recorder-head .eye-l{left:7px}.recorder-head .eye-r{right:7px}
.recorder-head .recorder-brow{position:absolute;z-index:3;top:7px;width:9px;height:2px;border-radius:2px;background:#4a2922}.recorder-head .brow-l{left:4px;transform:rotate(20deg)}.recorder-head .brow-r{right:4px;transform:rotate(-20deg)}
.recorder-head i{left:50%;right:auto;bottom:5px;width:8px;height:3px;transform:translateX(-50%);background:#642e25}
.recorder-zone.talking .recorder-head i{animation:recorderTalk .38s steps(2,end) infinite}
.big-recorder .recorder-head i{animation:recorderTalk .42s steps(2,end) infinite}
@keyframes lazyYawn{0%,55%,100%{transform:translateX(-50%) scale(.65)}70%,84%{transform:translateX(-50%) scale(1.12)}}
@media(min-width:701px) and (max-width:1180px){
  .collective-page.game-phase{height:100svh;min-height:0;overflow:hidden}
  .game-header{height:58px;padding-inline:18px}
  .back-button{padding:7px 11px}.game-sound{width:36px;height:36px}.game-title strong{font-size:17px}
  .status-strip{width:calc(100% - 28px);margin-top:8px}.status-strip>div{min-height:50px;padding:6px 10px}.status-strip strong{font-size:22px}
  .progress-track{width:calc(100% - 28px);margin-bottom:8px}
  .work-layout{width:calc(100% - 28px);height:calc(100svh - 129px);grid-template-columns:minmax(0,1fr) 250px;gap:12px}
  .work-scene{height:100%;min-height:0;border-width:5px}.work-controls{height:100%;min-height:0;gap:7px}
  .game-actions{padding:7px}.instructions-button{padding:7px}.action-row{margin-top:6px;gap:4px}.action-row button{padding:7px 2px;font-size:11px}
  .notice-card{padding:9px 11px}.notice-card p{margin-top:3px;line-height:1.35}.effort-meter{padding:8px 11px}.meter{margin-top:5px}
  .dig-button{min-height:0;flex:1;padding:8px}.hoe-icon{font-size:34px}.dig-button strong{font-size:23px}.dig-button small{margin-top:3px}.observe-button{padding:8px}
}
</style>
