<script setup>
import {computed, onBeforeUnmount, ref} from 'vue'
import {playClickSound, playDigSound, playHoverSound, toggleAllAudio, unlockAudio} from '../audio.js'

const props = defineProps({soundEnabled: Boolean, isOnline: Boolean})
const emit = defineEmits(['sound-change', 'back'])

const ROUND_SECONDS = 60
const BASE_YIELD = 0
const STATE_QUOTA = 80
const COLLECTIVE_SHARE = 20
const COLLECTIVE_GRAIN = 100
const HISTORY_KEY = 'egame-contract-history'

function readContractHistory() {
  try {
    const history = JSON.parse(sessionStorage.getItem(HISTORY_KEY))
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

const phase = ref('game')
const gameStatus = ref('ready')
const timeLeft = ref(ROUND_SECONDS)
const workCount = ref(0)
const countdown = ref(3)
const workerX = ref(47)
const workerY = ref(80)
const digPulse = ref(0)
const floatHits = ref([])
const showInstructions = ref(false)
const showResetConfirm = ref(false)
const showEndConfirm = ref(false)
const finalChoice = ref('')
const contractHistory = ref(readContractHistory())
const currentAttemptId = ref(null)
let timer
let countdownTimer
let hitId = 0
let resumeAfterInstructions = false
let restartCountdownAfterInstructions = false
let resumeAfterResetCancel = false
let restartCountdownAfterResetCancel = false
let resumeAfterEndCancel = false
let lastHoveredButton = null

const totalYield = computed(() => BASE_YIELD + workCount.value * 2)
const statePaid = computed(() => Math.min(totalYield.value, STATE_QUOTA))
const collectivePaid = computed(() => Math.min(Math.max(totalYield.value - STATE_QUOTA, 0), COLLECTIVE_SHARE))
const personalIncome = computed(() => Math.max(0, totalYield.value - STATE_QUOTA - COLLECTIVE_SHARE))
const highestWorkCount = computed(() => contractHistory.value.reduce((highest, item) => Math.max(highest, item.workCount), 0))
const timeProgress = computed(() => ((ROUND_SECONDS - timeLeft.value) / ROUND_SECONDS) * 100)
const chartMax = computed(() => Math.max(140, COLLECTIVE_GRAIN, personalIncome.value) * 1.12)
const collectiveBar = computed(() => `${Math.max(12, COLLECTIVE_GRAIN / chartMax.value * 100)}%`)
const contractBar = computed(() => personalIncome.value === 0 ? '0%' : `${Math.max(12, personalIncome.value / chartMax.value * 100)}%`)
const workerScale = computed(() => 0.78 + ((workerY.value - 62) / 30) * 0.24)
const statusText = computed(() => ({ready: '准备就绪', countdown: '即将开始', running: '干劲十足', paused: '已暂停', finished: '劳动结束'}[gameStatus.value]))

function runTimer() {
  window.clearInterval(timer)
  timer = window.setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) finishRound()
  }, 1000)
}

function startRound() {
  if (gameStatus.value === 'running' || gameStatus.value === 'countdown' || gameStatus.value === 'finished') return
  if (gameStatus.value === 'ready') {
    countdown.value = 3
    gameStatus.value = 'countdown'
    playClickSound()
    countdownTimer = window.setInterval(() => {
      if (countdown.value > 1) {
        countdown.value -= 1
        playClickSound()
      } else {
        window.clearInterval(countdownTimer)
        countdownTimer = undefined
        gameStatus.value = 'running'
        runTimer()
      }
    }, 1000)
    return
  }
  gameStatus.value = 'running'
  runTimer()
}

function pauseRound() {
  if (gameStatus.value !== 'running') return
  window.clearInterval(timer)
  timer = undefined
  gameStatus.value = 'paused'
}

function resetGame() {
  window.clearInterval(timer)
  window.clearInterval(countdownTimer)
  timer = undefined
  countdownTimer = undefined
  phase.value = 'game'
  gameStatus.value = 'ready'
  timeLeft.value = ROUND_SECONDS
  workCount.value = 0
  countdown.value = 3
  workerX.value = 47
  workerY.value = 80
  digPulse.value = 0
  floatHits.value = []
  finalChoice.value = ''
  currentAttemptId.value = null
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
    gameStatus.value = 'ready'
    startRound()
  }
  resumeAfterResetCancel = false
  restartCountdownAfterResetCancel = false
}

function openInstructions() {
  resumeAfterInstructions = gameStatus.value === 'running'
  restartCountdownAfterInstructions = gameStatus.value === 'countdown'
  if (resumeAfterInstructions) pauseRound()
  if (restartCountdownAfterInstructions) {
    window.clearInterval(countdownTimer)
    countdownTimer = undefined
    gameStatus.value = 'ready'
  }
  showInstructions.value = true
}

function closeInstructions() {
  showInstructions.value = false
  if (resumeAfterInstructions) {
    gameStatus.value = 'running'
    runTimer()
  } else if (restartCountdownAfterInstructions) startRound()
  resumeAfterInstructions = false
  restartCountdownAfterInstructions = false
}

function recordDig(x, y) {
  if (gameStatus.value !== 'running') return
  workerX.value = Math.max(18, Math.min(82, x))
  workerY.value = Math.max(62, Math.min(92, y))
  workCount.value += 1
  digPulse.value += 1
  const id = ++hitId
  floatHits.value.push({id, x: workerX.value, y: workerY.value - 22})
  window.setTimeout(() => (floatHits.value = floatHits.value.filter((item) => item.id !== id)), 700)
  playDigSound()
}

function digRandom() {
  recordDig(20 + Math.random() * 61, 64 + Math.random() * 27)
}

function digField(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width * 100
  const fieldY = (event.clientY - rect.top) / rect.height * 100
  recordDig(x, 62 + fieldY * 0.3)
}

function finishRound() {
  if (gameStatus.value === 'finished') return
  window.clearInterval(timer)
  timer = undefined
  timeLeft.value = 0
  gameStatus.value = 'finished'
  const attempt = {
    id: Date.now(),
    workCount: workCount.value,
    totalYield: totalYield.value,
    personalIncome: personalIncome.value,
    finishedAt: new Date().toISOString(),
  }
  currentAttemptId.value = attempt.id
  contractHistory.value = [...contractHistory.value, attempt]
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(contractHistory.value))
  phase.value = 'decision'
}

function chooseMotivation(choice) {
  finalChoice.value = choice
  contractHistory.value = contractHistory.value.map((attempt) => (
    attempt.id === currentAttemptId.value ? {...attempt, choice} : attempt
  ))
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(contractHistory.value))
  phase.value = 'summary'
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
  if (event.target.closest?.('button') && !event.target.closest?.('.contract-dig')) playClickSound()
}

onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.clearInterval(countdownTimer)
})
</script>

<template>
  <main class="contract-page" :class="{'game-phase': phase === 'game'}" @pointerdown.capture="unlockAudio" @pointerover="handlePointerOver" @pointerout="handlePointerOut" @click.capture="handleClick">
    <header class="contract-header">
      <button class="plain-button" type="button" @click="emit('back')">← 返回首页</button>
      <div class="contract-title"><div><strong>大包干模式</strong><small>包产到户 · 多劳多得</small></div></div>
      <div class="header-actions">
        <div class="connection-badge" :class="props.isOnline ? 'online' : 'offline'" role="status" aria-live="polite">
          <span aria-hidden="true">{{ props.isOnline ? '●' : '✓' }}</span>
          {{ props.isOnline ? '在线模式' : '离线模式' }}
        </div>
        <button class="sound-toggle" type="button" :aria-label="props.soundEnabled ? '关闭游戏音效' : '开启游戏音效'" @click="toggleSound">{{ props.soundEnabled ? '🔊' : '🔇' }}</button>
      </div>
    </header>

    <template v-if="phase === 'game'">
      <section class="contract-status">
        <div><span>剩余时间</span><strong>{{ timeLeft }}<small>秒</small></strong></div>
        <div><span>我的劳动</span><strong>{{ workCount }}<small>次</small></strong></div>
        <div><span>粮食产量</span><strong class="green-number">{{ totalYield }}<small>斤</small></strong></div>
        <div><span>归我所有</span><strong class="gold-number">{{ personalIncome }}<small>斤</small></strong></div>
      </section>
      <div class="contract-progress"><span :style="{width: `${timeProgress}%`}"></span></div>

      <section class="contract-layout">
        <div class="contract-field" :class="{inactive: gameStatus !== 'running'}">
          <div class="happy-sun"><i></i><b></b><span class="b-cheek cheek-l"></span><span class="b-cheek cheek-r"></span><em></em></div><div class="green-hills"></div><div class="field-soil"></div>
          <div class="field-click" role="button" aria-label="点击土地完成一次锄地" @pointerdown.prevent="digField"></div>
          <div class="planting row-a"><span v-for="n in 8" :key="`a-${n}`"><i></i></span></div>
          <div class="planting row-b"><span v-for="n in 7" :key="`b-${n}`"><i></i></span></div>
          <div class="contract-worker" :style="{left: `${workerX}%`, top: `${workerY}%`, '--scale': workerScale}">
            <div :key="digPulse" class="worker-drawing"><span class="worker-hat"></span><span class="worker-head"><i></i><b></b><em></em></span><span class="worker-body"></span><span class="worker-arm"></span><span class="worker-hoe"></span><span v-if="workCount" class="worker-sweat"></span></div>
          </div>
          <div class="diligent-npc" :class="{working: gameStatus === 'running'}" aria-hidden="true">
            <span class="npc-callout">自家收成，多干多得！</span>
            <div class="worker-drawing npc-drawing"><span class="worker-hat"></span><span class="worker-head"><i></i><b></b><em></em></span><span class="worker-body"></span><span class="worker-arm"></span><span class="worker-hoe"></span><span class="worker-sweat npc-sweat"></span></div>
            <b class="npc-label">努力劳作的承包户</b>
          </div>
          <TransitionGroup name="gain"><span v-for="hit in floatHits" :key="hit.id" class="yield-gain" :style="{left: `${hit.x}%`, top: `${hit.y}%`}">+2斤</span></TransitionGroup>
          <div v-if="gameStatus === 'countdown'" class="contract-countdown"><span>准备体验大包干</span><strong>{{ countdown }}</strong><small>倒计时后开始劳动</small></div>
          <div class="field-message"><strong>{{ statusText }}</strong><span>{{ gameStatus === 'running' ? '点击按钮或直接触摸土地，劳动越多收获越多' : '请先查看说明，然后点击开始' }}</span></div>
        </div>

        <aside class="contract-sidebar">
          <div class="control-card">
            <button class="help-button" type="button" @click="openInstructions">📜 游戏说明</button>
            <div><button class="start-control" type="button" :disabled="gameStatus === 'running' || gameStatus === 'countdown'" @click="startRound">{{ gameStatus === 'paused' ? '▶ 继续' : '▶ 开始' }}</button><button class="pause-control" type="button" :disabled="gameStatus !== 'running'" @click="pauseRound">Ⅱ 暂停</button><button class="replay-control" type="button" @click="requestReset">↻ 重玩</button><button class="end-control" type="button" :disabled="gameStatus !== 'running' && gameStatus !== 'paused'" @click="requestEarlyEnd">■ 结束</button></div>
          </div>

          <div class="policy-card"><span>大包干分配</span><div><i>{{ statePaid }} / 80斤</i>交够国家</div><div><i>{{ collectivePaid }} / 20斤</i>留足集体</div><div class="mine"><i>{{ personalIncome }}斤</i>剩下归自己</div></div>

          <div class="live-chart">
            <header><strong>两种模式实时对比</strong><small>固定规则</small></header>
            <div class="bars">
              <div><span class="bar collective-bar" :style="{height: collectiveBar}"><b>{{ COLLECTIVE_GRAIN }}</b></span><p>大锅饭模式<small>固定分配 · 个人所得100斤</small></p></div>
              <div><span class="bar contract-bar" :style="{height: contractBar}"><b>{{ personalIncome }}</b></span><p>大包干模式<small>劳动{{ workCount }}次 · 所得{{ personalIncome }}斤</small></p></div>
            </div>
          </div>

          <button class="contract-dig" type="button" :disabled="gameStatus !== 'running'" @pointerdown.prevent="digRandom"><span>⛏</span><strong>锄 地</strong><small>每次劳动，产量 +2斤</small></button>
        </aside>
      </section>
    </template>

    <section v-else-if="phase === 'decision'" class="decision-page">
      <p class="red-kicker">劳动结束 · 家庭结算</p>
      <h1>你的劳动，变成了自己的收获</h1>
      <div class="harvest-summary"><div><span>劳动次数</span><strong>{{ workCount }}次</strong></div><b>→</b><div><span>粮食总产量</span><strong>{{ totalYield }}斤</strong></div><b>→</b><div class="income"><span>家庭所得</span><strong>{{ personalIncome }}斤</strong></div></div>
      <div class="distribution-line"><span :style="{'--part': Math.max(statePaid, 10)}">国家任务 {{ statePaid }}斤</span><span :style="{'--part': Math.max(collectivePaid, 10)}">集体留成 {{ collectivePaid }}斤</span><span class="own-part" :style="{'--part': Math.max(personalIncome, 15)}">归自己 {{ personalIncome }}斤</span></div>
      <div class="recorded-score"><span>✓ 本轮成绩已记录</span><strong>当前最高劳动成绩：{{ highestWorkCount }}次</strong><small>本次浏览器会话共 {{ contractHistory.length }} 轮</small></div>
      <div class="choice-card"><p>如果多干一些，就能再多收50斤粮食，你会怎么选？</p><div><button type="button" @click="chooseMotivation('干劲十足')">💪 干劲十足</button><button type="button" @click="chooseMotivation('还是偷懒')">😴 还是偷懒</button></div></div>
    </section>

    <section v-else class="summary-page">
      <span class="summary-seal">收获</span><p class="red-kicker">大包干体验完成</p><h1>劳动越多，收获越多</h1>
      <p class="summary-lead">实行大包干后，完成国家和集体任务，剩余收获归家庭所有。劳动成果看得见，积极性自然提高。</p>
      <div class="final-compare">
        <div class="poor"><span>大锅饭模式</span><strong>{{ COLLECTIVE_GRAIN }}斤</strong><p>固定分配 · 全部归个人</p></div>
        <b>VS</b>
        <div class="rich"><span>大包干模式</span><strong>{{ personalIncome }}斤</strong><p>劳动{{ workCount }}次 · 多劳多得</p></div>
      </div>
      <p class="choice-result">你的选择：<strong>{{ finalChoice }}</strong></p>
      <section class="attempt-history">
        <header><div><span>本次浏览器会话</span><strong>已完成 {{ contractHistory.length }} 轮</strong></div><div class="best-score"><span>最高劳动成绩</span><strong>{{ highestWorkCount }}次</strong></div></header>
        <div class="attempt-list">
          <div v-for="(attempt, index) in contractHistory" :key="attempt.id" :class="{best: attempt.workCount === highestWorkCount}">
            <b>第 {{ index + 1 }} 轮</b><span>劳动 {{ attempt.workCount }} 次</span><span>产量 {{ attempt.totalYield }} 斤</span><span>个人所得 {{ attempt.personalIncome }} 斤</span><em v-if="attempt.workCount === highestWorkCount">最高</em>
          </div>
        </div>
      </section>
      <div class="summary-actions"><button class="reset-direct" type="button" @click="resetGame">↻ 重玩本轮</button><button class="finish-button" type="button" @click="emit('back')">完成体验 · 返回首页 →</button></div>
    </section>

    <Transition name="modal">
      <div v-if="showInstructions" class="modal-backdrop" @click.self="closeInstructions"><section class="info-dialog" role="dialog" aria-modal="true"><button class="modal-close" type="button" @click="closeInstructions">×</button><span class="dialog-badge">大包干规则</span><h2>土地承包给各家</h2><blockquote>“交够国家的，留足集体的，剩下的都是自己的！”</blockquote><div class="rule-list"><div><b>01</b><p><strong>努力劳动</strong><small>点击锄地按钮或直接触摸土地</small></p></div><div><b>02</b><p><strong>产量增长</strong><small>每劳动一次，粮食增加2斤</small></p></div><div><b>03</b><p><strong>家庭增收</strong><small>完成任务后，剩余粮食归自己</small></p></div></div><p class="pause-message">{{ resumeAfterInstructions ? '游戏已暂停，关闭说明后继续计时。' : '游戏未开始，阅读后点击开始。' }}</p><button class="finish-button dialog-ok" type="button" @click="closeInstructions">我明白了</button></section></div>
    </Transition>

    <Transition name="modal"><div v-if="showResetConfirm" class="modal-backdrop" @click.self="cancelReset"><section class="reset-dialog"><span>↻</span><h2>确定要重置吗？</h2><p>劳动会被清空哦，当前产量和剩余时间将无法恢复。</p><div><button type="button" @click="cancelReset">取消</button><button type="button" @click="resetGame">确定重置</button></div></section></div></Transition>
    <Transition name="modal"><div v-if="showEndConfirm" class="modal-backdrop" @click.self="cancelEarlyEnd"><section class="reset-dialog end-confirm-dialog"><span>■</span><h2>确定要提前结束吗？</h2><p>结束后将立即进入本轮结算，不能继续劳动。</p><div><button type="button" @click="cancelEarlyEnd">继续劳动</button><button type="button" @click="confirmEarlyEnd">确定结束</button></div></section></div></Transition>
  </main>
</template>

<style scoped>
.contract-page{min-height:100vh;min-height:100svh;color:#29271f;background:radial-gradient(circle at 80% 10%,rgba(210,183,90,.18),transparent 30%),#eee7d0}.contract-header{height:76px;padding:0 max(28px,calc((100vw - 1220px)/2));display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid rgba(75,82,42,.22);background:rgba(250,247,231,.76)}button{font:inherit}.plain-button{justify-self:start;padding:9px 13px;color:#67634e;cursor:pointer;border:1px solid rgba(75,82,42,.23);background:transparent}.contract-title{display:flex;align-items:center;gap:11px}.contract-title>span{width:43px;height:43px;display:grid;place-items:center;color:#f9f1d5;font-weight:900;border-radius:50%;background:#4f733f}.contract-title div{display:flex;flex-direction:column}.contract-title strong{font:900 19px/1.2 "STSong","SimSun",serif;letter-spacing:.1em}.contract-title small{margin-top:3px;color:#65705a;font-size:9px;letter-spacing:.18em}.sound-toggle{justify-self:end;width:42px;height:42px;cursor:pointer;border:1px solid rgba(75,82,42,.24);border-radius:50%;background:#f5efd9;font-size:18px}
.contract-status{width:min(1220px,calc(100% - 56px));margin:18px auto 0;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid rgba(75,82,42,.22);background:rgba(253,250,236,.72)}.contract-status>div{min-height:65px;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;border-right:1px solid rgba(75,82,42,.16)}.contract-status span{color:#716d59;font-size:11px}.contract-status strong{font:900 25px Georgia,serif}.contract-status small{margin-left:3px;font:500 11px sans-serif}.contract-status .green-number{color:#4e733f}.contract-status .gold-number{color:#a66a23}.contract-progress{width:min(1220px,calc(100% - 56px));height:5px;margin:0 auto 17px;background:#d1cbb0}.contract-progress span{display:block;height:100%;background:linear-gradient(90deg,#8aa653,#47743d);transition:width 1s linear}
.contract-layout{width:min(1220px,calc(100% - 56px));margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:21px}.contract-field{position:relative;min-height:570px;overflow:hidden;border:7px solid #f5edd5;outline:1px solid rgba(79,81,40,.25);background:linear-gradient(#a9d6d0 0 36%,#7f9a4a 36% 46%,#80683a 46%);box-shadow:0 17px 38px rgba(54,52,24,.15)}.contract-field.inactive::after{content:"";position:absolute;z-index:7;inset:0;pointer-events:none;background:rgba(60,57,31,.07)}.happy-sun{position:absolute;z-index:2;top:37px;right:10%;width:78px;height:78px;border-radius:50%;background:#e7a63d;box-shadow:0 0 0 17px rgba(236,182,77,.16);animation:sunHappy 3s ease-in-out infinite alternate}.happy-sun::before{content:"";position:absolute;inset:-27px;border:2px dashed rgba(239,180,67,.55);border-radius:50%;animation:spin 14s linear infinite}.happy-sun i,.happy-sun b{position:absolute;top:27px;width:7px;height:9px;border-radius:50%;background:#714626}.happy-sun i{left:21px}.happy-sun b{right:21px}.happy-sun em{position:absolute;left:50%;top:43px;width:20px;height:10px;border-bottom:3px solid #714626;border-radius:50%;transform:translateX(-50%)}.green-hills{position:absolute;left:-4%;right:-4%;top:25%;height:29%;background:#557744;clip-path:polygon(0 75%,16% 37%,31% 69%,48% 17%,64% 64%,79% 30%,100% 70%,100% 100%,0 100%)}.field-soil{position:absolute;inset:46% -10% -10%;background:repeating-linear-gradient(104deg,transparent 0,transparent 62px,rgba(48,48,25,.4) 65px,rgba(48,48,25,.4) 80px)}.field-click{position:absolute;z-index:6;inset:46% 0 0;cursor:crosshair;touch-action:manipulation}.contract-field.inactive .field-click{cursor:not-allowed}.planting{position:absolute;z-index:4;left:2%;right:2%;bottom:22px;display:flex;justify-content:space-around;align-items:flex-end;pointer-events:none}.planting.row-b{left:19%;bottom:143px;transform:scale(.72)}.planting>span{position:relative;width:24px;height:42px;animation:sway 2.3s ease-in-out infinite alternate}.planting>span:nth-child(2n){height:52px;animation-delay:-1s}.planting i{position:absolute;bottom:0;left:11px;width:3px;height:36px;background:#547d35}.planting i::before,.planting i::after{content:"";position:absolute;width:14px;height:9px;background:#72a348}.planting i::before{left:-13px;top:9px;border-radius:100% 0}.planting i::after{left:2px;top:18px;border-radius:0 100%}
.contract-worker{position:absolute;z-index:8;width:100px;height:170px;pointer-events:none;transform:translate(-50%,-100%) scale(var(--scale));transform-origin:center bottom;transition:left .28s ease,top .28s ease}.worker-drawing{position:relative;width:100px;height:170px;animation:work .2s ease}.worker-hat{position:absolute;z-index:3;top:17px;left:23px;width:65px;height:14px;border-radius:50%;background:#c99f40}.worker-hat::after{content:"";position:absolute;left:17px;bottom:6px;width:32px;height:24px;border-radius:50% 50% 0 0;background:#b88d32}.worker-head{position:absolute;top:29px;left:41px;width:30px;height:34px;border-radius:45%;background:#ac7148}.worker-head i,.worker-head b{position:absolute;top:13px;width:4px;height:5px;border-radius:50%;background:#452d24}.worker-head i{left:7px}.worker-head b{right:7px}.worker-head em{position:absolute;left:50%;bottom:5px;width:12px;height:5px;border-bottom:2px solid #63352b;border-radius:50%;transform:translateX(-50%)}.worker-body{position:absolute;top:61px;left:28px;width:52px;height:72px;border-radius:10px 10px 3px 3px;background:#507344}.worker-body::before,.worker-body::after{content:"";position:absolute;bottom:-39px;width:15px;height:45px;background:#354936}.worker-body::before{left:8px;transform:rotate(7deg)}.worker-body::after{right:7px;transform:rotate(-7deg)}.worker-arm{position:absolute;z-index:2;top:72px;left:68px;width:59px;height:12px;border-radius:9px;background:#ac7148;transform:rotate(30deg)}.worker-hoe{position:absolute;top:70px;left:112px;width:5px;height:120px;background:#5b422a;transform:rotate(-35deg);transform-origin:top}.worker-hoe::after{content:"";position:absolute;bottom:0;width:29px;height:9px;background:#34352c}.worker-sweat{position:absolute;top:43px;left:79px;width:7px;height:12px;border-radius:70% 30%;background:#c7f1f0;animation:sweat .65s ease-out forwards}.yield-gain{position:absolute;z-index:10;color:#fff0a8;font-weight:900;text-shadow:0 2px 4px #3f3a20;pointer-events:none;animation:gainUp .7s ease-out forwards}.contract-countdown{position:absolute;z-index:15;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff5d4;background:rgba(47,54,30,.68);backdrop-filter:blur(2px)}.contract-countdown span{font-size:12px;font-weight:900;letter-spacing:.25em}.contract-countdown strong{font:900 130px/1 Georgia}.contract-countdown small{font-size:11px}.field-message{position:absolute;z-index:11;left:50%;bottom:18px;padding:10px 18px;display:flex;flex-direction:column;color:#f8f0d2;text-align:center;background:rgba(50,68,41,.88);pointer-events:none;transform:translateX(-50%)}.field-message strong{font-family:serif}.field-message span{margin-top:2px;font-size:10px;white-space:nowrap}
.diligent-npc{position:absolute;z-index:5;left:21%;top:82%;width:100px;height:170px;pointer-events:none;transform:translate(-50%,-100%) scale(.7);transform-origin:center bottom;filter:saturate(.85)}.diligent-npc.working{filter:none;animation:npcPatrol 7s ease-in-out infinite}.diligent-npc:not(.working) .npc-drawing{animation:none}.diligent-npc.working .npc-drawing{animation:npcHoe .7s ease-in-out infinite}.diligent-npc .worker-body{background:#496a8a}.diligent-npc .worker-head em{height:6px;border:0;border-top:2px solid #63352b;border-radius:50%}.npc-callout{position:absolute;z-index:6;left:50%;top:-24px;padding:8px 11px;color:#fff4ce;font-size:11px;font-weight:800;white-space:nowrap;border-radius:3px;background:rgba(48,67,42,.92);transform:translateX(-50%)}.npc-callout::after{content:"";position:absolute;left:50%;bottom:-6px;border:6px solid transparent;border-top-color:rgba(48,67,42,.92);border-bottom:0;transform:translateX(-50%)}.npc-label{position:absolute;z-index:5;left:50%;bottom:-17px;padding:4px 8px;color:#f9f1cf;font-size:10px;white-space:nowrap;border-radius:10px;background:#4f743f;transform:translateX(-50%)}.diligent-npc .npc-sweat{opacity:0}.diligent-npc.working .npc-sweat{animation:npcSweat 1.1s ease-out infinite}
.contract-sidebar{display:flex;flex-direction:column;gap:10px}.control-card{padding:11px;border:1px solid rgba(75,82,42,.21);background:rgba(252,249,235,.7)}.help-button{width:100%;padding:9px;color:#48643d;font-weight:900;cursor:pointer;border:1px dashed rgba(75,111,58,.4);background:#e7eccf}.control-card>div{margin-top:8px;display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:6px}.control-card>div button{padding:9px 4px;color:#615d4c;font-size:12px;font-weight:800;cursor:pointer;border:1px solid rgba(75,82,42,.22);background:#f9f3df}.control-card .start-control{color:#f8f1d5;background:#4f743f}.control-card button:disabled{opacity:.4;cursor:not-allowed}.policy-card{padding:13px 15px;border-left:4px solid #557744;background:#f7f1dc}.policy-card>span{color:#4e733e;font-size:10px;font-weight:900;letter-spacing:.16em}.policy-card>div{margin-top:5px;display:flex;justify-content:space-between;color:#6c6654;font-size:11px}.policy-card i{color:#735d32;font-style:normal;font-weight:900}.policy-card .mine{margin-top:7px;padding-top:7px;color:#3f6b37;border-top:1px solid rgba(76,104,59,.2)}.policy-card .mine i{color:#4a743d}.live-chart{height:190px;padding:12px 15px;border:1px solid rgba(75,82,42,.2);background:#faf5e4}.live-chart header{display:flex;justify-content:space-between}.live-chart header strong{font:900 13px serif}.live-chart header small{color:#8b826d;font-size:9px}.bars{height:145px;padding:21px 15px 0;display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:end;border-bottom:1px solid #aaa184}.bars>div{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}.bar{position:relative;width:55px;min-height:20px;display:block;transition:height .22s ease}.bar b{position:absolute;top:-19px;left:50%;font:900 12px Georgia;transform:translateX(-50%)}.collective-bar{background:#9a5a42}.contract-bar{background:linear-gradient(#8eac50,#4e783d)}.bars p{margin:5px 0 0;text-align:center;font-size:10px;font-weight:900}.bars p small{display:block;margin-top:1px;color:#847966;font-size:8px;font-weight:500}.contract-dig{min-height:130px;padding:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f8f1ce;cursor:pointer;border:0;background:radial-gradient(circle at 50% 20%,#6f914e,#426a39);box-shadow:0 9px 20px rgba(53,83,44,.22);touch-action:manipulation}.contract-dig span{font-size:31px}.contract-dig strong{font:900 23px serif;letter-spacing:.25em}.contract-dig small{margin-top:4px}.contract-dig:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.5);box-shadow:none}
.decision-page,.summary-page{width:min(980px,calc(100% - 60px));margin:auto;padding:45px 0;text-align:center}.red-kicker{margin:0 0 8px;color:#4e733e;font-size:11px;font-weight:900;letter-spacing:.22em}.decision-page h1,.summary-page h1{margin:0;font:900 clamp(33px,4vw,48px)/1.3 "STSong","SimSun",serif}.harvest-summary{margin:32px 0 20px;display:flex;align-items:center;justify-content:center;gap:14px}.harvest-summary>div{min-width:190px;padding:17px;border:1px solid rgba(75,82,42,.24);background:#f8f3df}.harvest-summary span{display:block;color:#756e5b;font-size:11px}.harvest-summary strong{display:block;margin-top:6px;font:900 25px Georgia;color:#4e743e}.harvest-summary>b{color:#63804b;font-size:22px}.harvest-summary .income{background:#e1e7bf}.distribution-line{height:42px;display:flex;overflow:hidden;border-radius:3px}.distribution-line span{flex:var(--part);display:grid;place-items:center;color:#fff4d7;font-size:11px;background:#9b6340}.distribution-line span:nth-child(2){background:#b38a48}.distribution-line .own-part{background:#527b41}.choice-card{margin-top:27px;padding:20px;border:1px solid rgba(75,82,42,.22);background:#faf5e5}.choice-card p{margin:0;font:900 18px serif}.choice-card>div{margin-top:15px;display:flex;justify-content:center;gap:13px}.choice-card button{min-width:190px;padding:14px;color:#4d673f;font-weight:900;cursor:pointer;border:1px solid rgba(76,109,59,.35);background:#e3e8c7}.choice-card button:last-child{color:#716456;background:#eee3cc}.summary-seal{width:70px;height:70px;margin:0 auto 17px;display:grid;place-items:center;color:#f6edca;font:900 16px serif;border:5px double #d9bd6d;border-radius:50%;background:#4d703e}.summary-lead{max-width:730px;margin:17px auto;color:#625e4c;line-height:1.8}.final-compare{margin:28px auto;display:grid;grid-template-columns:1fr 54px 1fr;align-items:center}.final-compare>div{padding:21px;border:1px solid}.final-compare span{font-size:11px;font-weight:900;letter-spacing:.14em}.final-compare strong{display:block;margin:8px 0;font:900 31px Georgia}.final-compare p{margin:0;font-size:12px}.final-compare .poor{color:#7b4838;border-color:#b68e75;background:#efdcca}.final-compare .rich{color:#456b39;border-color:#86a373;background:#dce6bd}.final-compare>b{color:#8d7e5e}.choice-result{color:#716a57}.choice-result strong{color:#4e733e}.summary-actions{display:flex;justify-content:center;gap:11px}.reset-direct,.finish-button{padding:14px 22px;font-weight:900;cursor:pointer}.reset-direct{color:#4d673f;border:1px solid rgba(76,109,59,.35);background:#eef0d8}.finish-button{color:#f8f1d2;border:0;background:#4d733e}.modal-backdrop{position:fixed;z-index:40;inset:0;padding:28px;display:grid;place-items:center;background:rgba(35,38,24,.72);backdrop-filter:blur(5px)}.info-dialog{position:relative;width:min(720px,100%);max-height:calc(100svh - 56px);overflow:auto;padding:30px 38px;text-align:center;border:1px solid rgba(75,82,42,.35);background:#f8f3df}.modal-close{position:absolute;top:14px;right:15px;width:35px;height:35px;cursor:pointer;border:1px solid rgba(75,82,42,.25);border-radius:50%;background:transparent;font-size:24px}.dialog-badge{color:#4e733e;font-size:11px;font-weight:900;letter-spacing:.18em}.info-dialog h2{margin:7px 0;font:900 31px serif}.info-dialog blockquote{margin:14px 0;padding:13px;color:#f7f0d0;background:#4d703e}.rule-list{text-align:left}.rule-list>div{padding:12px 8px;display:flex;gap:18px;border-bottom:1px solid rgba(75,82,42,.15)}.rule-list b{color:#76905e;font:900 22px Georgia}.rule-list p{margin:0;display:flex;flex-direction:column}.rule-list strong{font-family:serif}.rule-list small{margin-top:3px;color:#7b7460}.pause-message{padding:8px;color:#45683a;font-size:11px;background:#e6e9ca}.dialog-ok{margin-top:13px;min-width:190px}.reset-dialog{width:min(430px,100%);padding:31px;text-align:center;background:#f8f2de}.reset-dialog>span{width:56px;height:56px;margin:auto;display:grid;place-items:center;color:#f8f0d0;border-radius:50%;background:#4e733e;font-size:26px}.reset-dialog h2{font:900 28px serif}.reset-dialog p{color:#6e6856}.reset-dialog>div{display:grid;grid-template-columns:1fr 1fr;gap:9px}.reset-dialog button{padding:12px;cursor:pointer;border:1px solid rgba(75,82,42,.23);background:#f3ecd6}.reset-dialog button:last-child{color:#f8f0d0;background:#4e733e}.modal-enter-active,.modal-leave-active{transition:opacity .18s}.modal-enter-from,.modal-leave-to{opacity:0}
.attempt-history{margin:0 auto 22px;text-align:left;border:1px solid rgba(75,82,42,.22);background:#faf5e4}.attempt-history>header{padding:13px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(75,82,42,.16)}.attempt-history>header div{display:flex;flex-direction:column}.attempt-history>header span{color:#756e5b;font-size:10px}.attempt-history>header strong{margin-top:3px;color:#476b3b;font:900 17px serif}.attempt-history .best-score{min-width:150px;padding-left:18px;border-left:3px solid #6f934f}.attempt-list{max-height:190px;overflow:auto}.attempt-list>div{min-height:43px;padding:8px 15px;display:grid;grid-template-columns:85px repeat(3,1fr) 48px;align-items:center;gap:8px;color:#6d6654;font-size:11px;border-top:1px solid rgba(75,82,42,.1)}.attempt-list>div:first-child{border-top:0}.attempt-list b{color:#4d653f}.attempt-list em{padding:3px 6px;color:#fff5d8;font-style:normal;text-align:center;border-radius:10px;background:#608244}.attempt-list .best{background:rgba(218,229,184,.45)}
.recorded-score{margin:16px auto 0;padding:10px 15px;display:flex;align-items:center;justify-content:center;gap:20px;color:#496b3d;border:1px solid rgba(92,126,70,.28);background:#e7eccf}.recorded-score span{font-size:11px;font-weight:900}.recorded-score strong{font:900 16px serif}.recorded-score small{color:#766f5d}
@keyframes work{0%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}100%{transform:rotate(0)}}@keyframes npcHoe{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(7deg)}}@keyframes npcPatrol{0%,100%{left:21%;top:82%}33%{left:31%;top:74%}66%{left:17%;top:69%}}@keyframes npcSweat{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(15px,25px)}}@keyframes gainUp{to{opacity:0;transform:translate(-50%,-70px)}}@keyframes sweat{to{opacity:0;transform:translate(13px,23px)}}@keyframes sway{from{transform:rotate(-3deg)}to{transform:rotate(4deg)}}@keyframes sunHappy{to{transform:translateY(-6px);box-shadow:0 0 0 25px rgba(236,182,77,.18)}}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1000px){.contract-header{padding-inline:20px}.contract-status,.contract-progress,.contract-layout{width:calc(100% - 36px)}.contract-layout{grid-template-columns:minmax(0,1fr) 250px}.contract-title small{display:none}.contract-status>div{padding:8px 10px}.contract-field{min-height:530px}.live-chart{height:175px}.bars{height:130px}.contract-dig{min-height:115px}}
@media(max-width:700px){.contract-layout{grid-template-columns:1fr}.contract-sidebar{display:grid;grid-template-columns:1fr 1fr}.contract-dig{grid-column:2;grid-row:1/3}.live-chart{grid-column:1/3}.contract-field{min-height:460px}.contract-status{grid-template-columns:repeat(4,1fr)}.contract-status>div{flex-direction:column;justify-content:center}.harvest-summary>div{min-width:0;flex:1}.decision-page,.summary-page{width:calc(100% - 40px)}}
.happy-sun{background:#bc4b2e;box-shadow:0 0 0 16px rgba(202,87,41,.1);animation:bSunFloat 4s ease-in-out infinite,bSunGlow 2.8s ease-in-out infinite alternate;isolation:isolate}
.happy-sun::before{inset:-14px;border:2px solid rgba(196,79,42,.22);border-radius:50%;animation:bSunRing 2.8s ease-out infinite}
.happy-sun::after{content:"";position:absolute;inset:-38px;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(244,190,82,.62) 0deg 3deg,transparent 3deg 45deg);-webkit-mask:radial-gradient(circle,transparent 0 43%,#000 45% 100%);mask:radial-gradient(circle,transparent 0 43%,#000 45% 100%);animation:bHeatRays 2.2s ease-in-out infinite alternate}
.happy-sun i,.happy-sun b{z-index:3;top:27px;width:8px;height:11px;background:#5c2e25;box-shadow:inset 2px 1px 0 rgba(255,255,255,.28);animation:bSunBlink 4.2s ease-in-out infinite}.happy-sun i{left:21px}.happy-sun b{right:21px;animation-delay:.08s}.happy-sun em{z-index:3;top:41px;width:19px;height:12px;border-bottom:3px solid #692f25}
.b-cheek{position:absolute;z-index:3;top:44px;width:12px;height:6px;border-radius:50%;background:rgba(137,38,31,.35)}.b-cheek.cheek-l{left:10px}.b-cheek.cheek-r{right:10px}
@keyframes bSunFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes bSunGlow{from{box-shadow:0 0 0 12px rgba(202,87,41,.09),0 0 20px rgba(202,87,41,.13)}to{box-shadow:0 0 0 23px rgba(202,87,41,.13),0 0 45px rgba(202,87,41,.26)}}@keyframes bSunRing{0%{opacity:.7;transform:scale(.82)}100%{opacity:0;transform:scale(1.2)}}@keyframes bHeatRays{from{opacity:.48;transform:scale(.88) rotate(-2deg)}to{opacity:1;transform:scale(1.08) rotate(2deg)}}@keyframes bSunBlink{0%,44%,50%,100%{transform:scaleY(1)}47%{transform:scaleY(.08)}}
.control-card>div{grid-template-columns:repeat(4,1fr)}
.control-card .start-control{color:#f6f2d7;border-color:#426737;background:#4f783f}
.control-card .pause-control{color:#3f321d;border-color:#c89431;background:#e2b957}
.control-card .replay-control{color:#eef6fb;border-color:#356886;background:#477e9f}
.control-card .end-control{color:#fff0da;border-color:#933327;background:#a83e30}
.contract-dig{color:#fff1cc;background:radial-gradient(circle at 50% 35%,#bb5238,#8e2f24 70%);box-shadow:0 12px 25px rgba(104,37,28,.23),inset 0 0 0 5px rgba(255,237,196,.1)}
.contract-dig:active{transform:scale(.975)}
.contract-dig:disabled:active{transform:none}
.end-confirm-dialog>span{background:#a83e30}.reset-dialog.end-confirm-dialog button:last-child{color:#fff0da;background:#a83e30}
@media(min-width:701px) and (max-width:1180px){
  .contract-page.game-phase{height:100svh;min-height:0;overflow:hidden}
  .contract-header{height:58px;padding-inline:18px}.plain-button{padding:7px 11px}.sound-toggle{width:36px;height:36px}.contract-title strong{font-size:17px}
  .contract-status{width:calc(100% - 28px);margin-top:8px}.contract-status>div{min-height:50px;padding:6px 10px}.contract-status strong{font-size:22px}
  .contract-progress{width:calc(100% - 28px);margin-bottom:8px}
  .contract-layout{width:calc(100% - 28px);height:calc(100svh - 128px);grid-template-columns:minmax(0,1fr) 250px;gap:12px}
  .contract-field{height:100%;min-height:0;border-width:5px}.contract-sidebar{height:100%;min-height:0;gap:6px}
  .control-card{padding:7px}.help-button{padding:7px}.control-card>div{margin-top:5px;gap:4px}.control-card>div button{padding:7px 2px;font-size:11px}
  .policy-card{padding:8px 10px}.policy-card>div{margin-top:3px}.policy-card .mine{margin-top:4px;padding-top:4px}
  .live-chart{height:auto;min-height:120px;flex:1;padding:8px 10px}.bars{height:calc(100% - 19px);min-height:95px;padding:18px 8px 0;gap:12px}.bar{width:46px}
  .contract-dig{min-height:94px;padding:7px}.contract-dig span{font-size:26px}.contract-dig strong{font-size:21px}.contract-dig small{margin-top:2px}
}
</style>
