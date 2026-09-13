<script setup>
import {onBeforeUnmount, ref} from 'vue'
import {
  playClickSound,
  playHoverSound,
  stopAudio,
  toggleAllAudio,
  unlockAudio,
} from './audio.js'
import CollectiveGame from './components/CollectiveGame.vue'
import ContractGame from './components/ContractGame.vue'

const showReadyMessage = ref(false)
const showModeDialog = ref(false)
const selectedModeName = ref('')
const soundEnabled = ref(true)
const currentScreen = ref('intro')
let lastHoveredButton = null

async function startGame() {
  await unlockAudio()
  showModeDialog.value = true
}

function closeModeDialog() {
  showModeDialog.value = false
}

async function selectMode(mode) {
  await unlockAudio()
  selectedModeName.value = mode === 'collective' ? '大锅饭模式' : '大包干模式'
  showModeDialog.value = false
  if (mode === 'collective') {
    currentScreen.value = 'collective'
    return
  }
  currentScreen.value = 'contract'
}

function returnHome() {
  currentScreen.value = 'intro'
}

function syncSoundState(value) {
  soundEnabled.value = value
}

async function toggleSound() {
  soundEnabled.value = await toggleAllAudio()
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
  const nextButton = event.relatedTarget?.closest?.('button')
  if (!nextButton) lastHoveredButton = null
}

function handleButtonClick(event) {
  if (event.target.closest?.('button')) playClickSound()
}

onBeforeUnmount(stopAudio)
</script>

<template>
  <main
      v-if="currentScreen === 'intro'"
      class="intro-page"
      @pointerdown.capture="unlockAudio"
      @pointerover="handlePointerOver"
      @pointerout="handlePointerOut"
      @click.capture="handleButtonClick"
  >
    <div class="paper-grain" aria-hidden="true"></div>

    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">穗</span>
        <div><strong>生产队大考验</strong><span>劳动与收获模拟体验</span></div>
      </div>
      <button
          class="sound-button"
          type="button"
          :class="{ muted: !soundEnabled }"
          :aria-label="soundEnabled ? '关闭游戏音效' : '开启游戏音效'"
          :title="soundEnabled ? '关闭游戏音效' : '开启游戏音效'"
          @click="toggleSound"
      >
        <span aria-hidden="true">{{ soundEnabled ? '🔊' : '🔇' }}</span>
      </button>
    </header>

    <section class="hero-section">
      <div class="story-column">
        <div class="year-label"><span>时光倒流</span><strong>1978</strong></div>
        <p class="eyebrow">第一章 · 走进生产队</p>
        <h1>一分耕耘，<br/><em>一定有一分收获吗？</em></h1>
        <p class="lead">
          现在，你不再是一名小学生，而是生产队里的一名社员。你要下地劳动、挣取工分，并用工分换取一家人的口粮！</p>

        <div class="mission-card">
          <div class="mission-icon">任<br/>务</div>
          <div>
            <span class="mission-label">你的任务</span>
            <p>亲手种完两轮庄稼，看看不同的分配方式，会让收获发生什么变化。</p>
          </div>
        </div>

        <button class="start-button" type="button" @click="startGame">
          <span>领取社员证 · 开始种地</span><span class="button-arrow">→</span>
        </button>
        <p class="time-tip"><span>◷</span>体验约需 10 分钟，本次成绩将在关闭游戏后清空</p>
      </div>

      <div class="scene-column" aria-label="夕阳下的生产队农田">
        <div class="scene-frame">
          <div class="sun"></div>
          <div class="cloud cloud-one"></div>
          <div class="cloud cloud-two"></div>
          <div class="mountain mountain-back"></div>
          <div class="mountain mountain-front"></div>
          <div class="village">
            <div class="house house-one"><i></i></div>
            <div class="house house-two"><i></i></div>
            <div class="tree tree-one"></div>
            <div class="tree tree-two"></div>
          </div>
          <div class="field"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="farmer">
            <div class="farmer-head"></div>
            <div class="farmer-hat"></div>
            <div class="farmer-body"></div>
            <div class="farmer-leg leg-left"></div>
            <div class="farmer-leg leg-right"></div>
            <div class="hoe"></div>
          </div>
          <div class="scene-caption"><span>小岗生产队 · 冬</span><strong>粮食告急</strong></div>
        </div>
        <blockquote>“地还是那块地，人还是那些人，<br/>为什么大家渐渐没有了干劲？”</blockquote>
      </div>
    </section>

    <footer class="page-footer"><span>人民公社 · 生产劳动体验</span><span
        class="footer-line"></span><span>01 / 05</span></footer>

    <Transition name="dialog">
      <div v-if="showModeDialog" class="dialog-backdrop" @click.self="closeModeDialog">
        <section class="mode-dialog" role="dialog" aria-modal="true" aria-labelledby="mode-title">
          <button class="dialog-close" type="button" aria-label="关闭模式选择" @click="closeModeDialog">×</button>

          <header class="dialog-header">
            <span class="dialog-step">社员证已领取</span>
            <h2 id="mode-title">请选择你的游戏模式</h2>
            <p>请选择要体验的生产模式，观察不同制度下的劳动与收获。</p>
          </header>

          <div class="mode-options">
            <button class="mode-card collective-card" type="button" @click="selectMode('collective')">
              <span class="mode-kicker">人民公社时期</span>
              <strong>大锅饭模式</strong>
              <span class="mode-slogan">干多干少一个样</span>
              <span class="mode-rule"><i>10</i> 个固定工分</span>
              <span class="mode-description">集体劳动，粮食统一分配。你的付出会得到怎样的回报？</span>
              <span class="mode-enter">进入大锅饭模式 <b>→</b></span>
            </button>

            <div class="versus" aria-hidden="true"><span>VS</span></div>

            <button class="mode-card contract-card" type="button" @click="selectMode('contract')">
              <span class="mode-kicker">改革探索时期</span>
              <strong>大包干模式</strong>
              <span class="mode-slogan">多劳多得，勤劳致富</span>
              <span class="mode-rule"><i>+</i> 劳动带来更多收获</span>
              <span class="mode-description">包产到户，完成任务后的收获归自己。你会如何选择？</span>
              <span class="mode-enter">进入大包干模式 <b>→</b></span>
            </button>
          </div>

          <p class="dialog-tip"><span>!</span> 选择后将直接进入对应模式</p>
        </section>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="showReadyMessage" class="ready-toast" role="status"><span>✓</span>已选择 {{
          selectedModeName
        }}，下一环节即将开放
      </div>
    </Transition>
  </main>
  <CollectiveGame
      v-else-if="currentScreen === 'collective'"
      :sound-enabled="soundEnabled"
      @sound-change="syncSoundState"
      @back="returnHome"
  />
  <ContractGame
      v-else-if="currentScreen === 'contract'"
      :sound-enabled="soundEnabled"
      @sound-change="syncSoundState"
      @back="returnHome"
  />
</template>
