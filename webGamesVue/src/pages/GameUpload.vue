<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { post } from '../config/api'

const router = useRouter()

// Upload modes
type UploadMode = 'html' | 'zip' | 'link'
const currentMode = ref<UploadMode>('html')

// Common form fields
const author = ref('')
const isUploading = ref(false)
const error = ref('')
const success = ref('')

// HTML upload fields
const htmlFile = ref<File | null>(null)

// ZIP upload fields
const zipFile = ref<File | null>(null)
const zipGameId = ref('')

// Link upload fields
const linkGameId = ref('')
const linkUrl = ref('')
const linkPreviewImage = ref<File | null>(null)

const resetForm = () => {
  author.value = ''
  error.value = ''
  success.value = ''
  htmlFile.value = null
  zipFile.value = null
  zipGameId.value = ''
  linkGameId.value = ''
  linkUrl.value = ''
  linkPreviewImage.value = null
}

const handleModeChange = (mode: UploadMode) => {
  currentMode.value = mode
  resetForm()
}

const handleHtmlFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    if (!input.files[0].name.toLowerCase().endsWith('.html')) {
      error.value = '请选择HTML文件'
      return
    }
    htmlFile.value = input.files[0]
    error.value = ''
  }
}

const handleZipFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    if (!input.files[0].name.toLowerCase().endsWith('.zip')) {
      error.value = '请选择ZIP文件'
      return
    }
    zipFile.value = input.files[0]
    error.value = ''
  }
}

const handlePreviewImageChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      error.value = '请选择PNG、JPG或GIF格式的图片'
      return
    }
    linkPreviewImage.value = file
    error.value = ''
  }
}

const validateGameId = (gameId: string) => {
  if (!gameId) return '游戏ID不能为空'
  if (!/^[a-zA-Z0-9]+$/.test(gameId)) return '游戏ID只能包含英文字母和数字'
  if (gameId.length < 2) return '游戏ID至少需要2个字符'
  if (gameId.length > 50) return '游戏ID不能超过50个字符'
  return null
}

const validateUrl = (url: string) => {
  if (!url) return '游戏链接不能为空'
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return '链接必须以 http:// 或 https:// 开头'
  }
  return null
}

const canSubmit = computed(() => {
  if (currentMode.value === 'html') {
    return htmlFile.value && !isUploading.value
  } else if (currentMode.value === 'zip') {
    return zipFile.value && zipGameId.value && !isUploading.value
  } else if (currentMode.value === 'link') {
    return linkGameId.value && linkUrl.value && linkPreviewImage.value && !isUploading.value
  }
  return false
})

const handleUpload = async () => {
  if (!canSubmit.value) return

  error.value = ''
  success.value = ''
  isUploading.value = true

  try {
    const formData = new FormData()

    if (currentMode.value === 'html') {
      if (!htmlFile.value) throw new Error('请选择HTML文件')
      
      formData.append('game_file', htmlFile.value)
      formData.append('author', author.value || '匿名')

      const response = await post('/upload-game', formData)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || '上传失败')
      }

      success.value = '游戏上传成功！正在跳转到首页...'
      setTimeout(() => {
        router.push('/')
      }, 2000)

    } else if (currentMode.value === 'zip') {
      if (!zipFile.value || !zipGameId.value) throw new Error('请填写完整信息')
      
      const gameIdError = validateGameId(zipGameId.value)
      if (gameIdError) throw new Error(gameIdError)

      formData.append('zip_file', zipFile.value)
      formData.append('game_id', zipGameId.value.toLowerCase())
      formData.append('author', author.value || '匿名')

      const response = await post('/upload-zip', formData)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || '上传失败')
      }

      success.value = 'ZIP游戏包上传成功！正在跳转到首页...'
      setTimeout(() => {
        router.push('/')
      }, 2000)

    } else if (currentMode.value === 'link') {
      if (!linkGameId.value || !linkUrl.value || !linkPreviewImage.value) {
        throw new Error('请填写完整信息')
      }
      
      const gameIdError = validateGameId(linkGameId.value)
      if (gameIdError) throw new Error(gameIdError)
      
      const urlError = validateUrl(linkUrl.value)
      if (urlError) throw new Error(urlError)

      formData.append('game_id', linkGameId.value.toLowerCase())
      formData.append('link', linkUrl.value)
      formData.append('image_file', linkPreviewImage.value)
      formData.append('author', author.value || '匿名')

      const response = await post('/upload-link', formData)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || '上传失败')
      }

      success.value = '外部链接游戏注册成功！正在跳转到首页...'
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }

  } catch (err) {
    error.value = err instanceof Error ? err.message : '上传失败'
    console.error('Upload error:', err)
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="upload-page">
    <div class="upload-container">
      <h1>上传你的小游戏</h1>
      <p class="subtitle">分享你的HTML5游戏给社区</p>

      <!-- Mode Selection -->
      <div class="mode-selection">
        <button 
          :class="['mode-btn', { active: currentMode === 'html' }]"
          @click="handleModeChange('html')"
        >
          📄 单文件HTML
        </button>
        <button 
          :class="['mode-btn', { active: currentMode === 'zip' }]"
          @click="handleModeChange('zip')"
        >
          📦 ZIP游戏包
        </button>
        <button 
          :class="['mode-btn', { active: currentMode === 'link' }]"
          @click="handleModeChange('link')"
        >
          🔗 外部链接
        </button>
      </div>

      <!-- Upload Forms -->
      <div class="upload-form">
        <!-- HTML Upload -->
        <div v-if="currentMode === 'html'" class="upload-section">
          <h2>上传单文件HTML游戏</h2>
          <div class="form-group">
            <label for="html-file">选择HTML文件 *</label>
            <input
              id="html-file"
              type="file"
              accept=".html"
              @change="handleHtmlFileChange"
              :disabled="isUploading"
            >
            <p class="file-info" v-if="htmlFile">
              选中文件: {{ htmlFile.name }}
            </p>
          </div>
          <div class="form-group">
            <label for="html-author">作者名称</label>
            <input
              id="html-author"
              v-model="author"
              type="text"
              placeholder="请输入作者名称（可选）"
              maxlength="32"
              :disabled="isUploading"
            >
          </div>
        </div>

        <!-- ZIP Upload -->
        <div v-if="currentMode === 'zip'" class="upload-section">
          <h2>上传ZIP游戏包</h2>
          <div class="form-group">
            <label for="zip-game-id">游戏ID *</label>
            <input
              id="zip-game-id"
              v-model="zipGameId"
              type="text"
              placeholder="请输入游戏ID（英文数字组合）"
              pattern="[A-Za-z0-9]+"
              maxlength="50"
              :disabled="isUploading"
              @input="zipGameId = zipGameId.toLowerCase()"
            >
            <p class="input-hint">只能使用英文字母和数字，将自动转为小写</p>
          </div>
          <div class="form-group">
            <label for="zip-file">选择ZIP文件 *</label>
            <input
              id="zip-file"
              type="file"
              accept=".zip"
              @change="handleZipFileChange"
              :disabled="isUploading"
            >
            <p class="file-info" v-if="zipFile">
              选中文件: {{ zipFile.name }}
            </p>
          </div>
          <div class="form-group">
            <label for="zip-author">作者名称</label>
            <input
              id="zip-author"
              v-model="author"
              type="text"
              placeholder="请输入作者名称（可选）"
              maxlength="32"
              :disabled="isUploading"
            >
          </div>
        </div>

        <!-- Link Upload -->
        <div v-if="currentMode === 'link'" class="upload-section">
          <h2>注册外部链接游戏</h2>
          <div class="form-group">
            <label for="link-game-id">游戏ID *</label>
            <input
              id="link-game-id"
              v-model="linkGameId"
              type="text"
              placeholder="请输入游戏ID（英文数字组合）"
              pattern="[A-Za-z0-9]+"
              maxlength="50"
              :disabled="isUploading"
              @input="linkGameId = linkGameId.toLowerCase()"
            >
            <p class="input-hint">只能使用英文字母和数字，将自动转为小写</p>
          </div>
          <div class="form-group">
            <label for="link-url">游戏链接 *</label>
            <input
              id="link-url"
              v-model="linkUrl"
              type="url"
              placeholder="http://example.com/your-game"
              :disabled="isUploading"
            >
            <p class="input-hint">必须以 http:// 或 https:// 开头</p>
          </div>
          <div class="form-group">
            <label for="link-preview">预览图片 *</label>
            <input
              id="link-preview"
              type="file"
              accept="image/png,image/jpeg,image/gif"
              @change="handlePreviewImageChange"
              :disabled="isUploading"
            >
            <p class="file-info" v-if="linkPreviewImage">
              选中图片: {{ linkPreviewImage.name }}
            </p>
            <p class="input-hint">支持PNG、JPG、GIF格式，推荐尺寸16:9</p>
          </div>
          <div class="form-group">
            <label for="link-author">作者名称</label>
            <input
              id="link-author"
              v-model="author"
              type="text"
              placeholder="请输入作者名称（可选）"
              maxlength="32"
              :disabled="isUploading"
            >
          </div>
        </div>

        <!-- Error/Success Messages -->
        <div v-if="error" class="message error-message">
          ❌ {{ error }}
        </div>
        <div v-if="success" class="message success-message">
          ✅ {{ success }}
        </div>

        <!-- Upload Button -->
        <button 
          class="upload-button"
          @click="handleUpload"
          :disabled="!canSubmit"
        >
          <span v-if="isUploading">正在上传...</span>
          <span v-else>上传游戏</span>
        </button>
      </div>

      <!-- Upload Guidelines -->
      <div class="upload-guidelines">
        <h2>📋 上传说明</h2>
        
        <div class="guidelines-section">
          <h3>📄 单文件HTML游戏</h3>
          <ul>
            <li>适用于只有一个HTML文件的简单游戏</li>
            <li>系统会自动为你创建游戏文件夹并将文件命名为index.html</li>
            <li>游戏名称将根据文件名自动生成</li>
            <li>适合纯HTML/CSS/JavaScript编写的小游戏</li>
          </ul>
        </div>

        <div class="guidelines-section">
          <h3>📦 ZIP游戏包上传</h3>
          <ul>
            <li>适用于Unity、PixiJS、Phaser等需要额外资源文件的游戏</li>
            <li>压缩包根目录必须包含<code>index.html</code>文件作为入口</li>
            <li>或者只包含一个子文件夹，其内含<code>index.html</code></li>
            <li>可以包含<code>preview.png</code>文件作为游戏预览图</li>
            <li>支持各种资源文件：图片、音频、字体、脚本等</li>
            <li>最大文件大小：200MB</li>
            <li>上传后可通过游戏ID访问：<code>/game/你的游戏ID</code></li>
          </ul>
        </div>

        <div class="guidelines-section">
          <h3>🔗 外部链接游戏</h3>
          <ul>
            <li>适用于已部署在其他服务器上的游戏</li>
            <li>系统会为该链接生成一个本地入口</li>
            <li>必须上传一张预览图片（PNG、JPG或GIF格式）</li>
            <li>推荐预览图尺寸为16:9比例，如1920×1080或1280×720</li>
            <li>点击游戏卡片时会自动跳转到你提供的外部链接</li>
          </ul>
        </div>

        <div class="guidelines-section">
          <h3>🎮 通用要求</h3>
          <ul>
            <li>游戏必须能在现代浏览器中正常运行</li>
            <li>内容必须适合所有年龄段，无不当内容</li>
            <li>游戏ID一旦确定无法修改，请谨慎选择</li>
            <li>相同IP地址的用户可以覆盖自己上传的游戏</li>
            <li>游戏成功上传后会出现在首页游戏列表中</li>
          </ul>
        </div>

        <div class="guidelines-section">
          <h3>🏆 排行榜接口（可选）</h3>
          <div class="api-info">
            <p>如果你的游戏需要排行榜功能，可以使用以下API：</p>
            <pre><code>// 提交成绩
POST /scores
Body: {
  "game": "你的游戏ID",
  "difficulty": "easy|medium|hard",
  "name": "玩家名",
  "score": 1234
}

// 获取排行榜
GET /scores?game=你的游戏ID&difficulty=medium</code></pre>
            <p class="api-note">difficulty参数可选，默认为medium。服务器会自动保存每位玩家的历史最高分。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-page {
  padding: 2rem 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.upload-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1rem;
}

h1 {
  margin-bottom: 0.5rem;
  text-align: center;
  color: var(--color-text);
  font-size: 2.5rem;
}

.subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.mode-selection {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.mode-btn {
  padding: 1rem 1.5rem;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 140px;
}

.mode-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.mode-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
}

.upload-form {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.upload-section h2 {
  margin-bottom: 1.5rem;
  color: var(--color-text);
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--color-text);
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
  background: var(--color-background);
  color: var(--color-text);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.file-info {
  font-size: 0.875rem;
  color: var(--color-primary);
  margin-top: 0.5rem;
  margin-bottom: 0;
  font-weight: 500;
}

.message {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.success-message {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.upload-button {
  width: 100%;
  padding: 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
}

.upload-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.upload-guidelines {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.upload-guidelines h2 {
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
  color: var(--color-text);
}

.guidelines-section {
  margin-bottom: 2rem;
}

.guidelines-section h3 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: var(--color-primary);
}

.guidelines-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.guidelines-section li {
  margin-bottom: 0.75rem;
  padding-left: 1.5rem;
  position: relative;
  line-height: 1.5;
}

.guidelines-section li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: bold;
}

.guidelines-section code {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.api-info {
  background: rgba(59, 130, 246, 0.05);
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--color-primary);
}

.api-info pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1rem 0;
}

.api-info code {
  background: transparent;
  color: var(--color-text);
  padding: 0;
  font-size: 0.875rem;
}

.api-note {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: 0.5rem;
  font-style: italic;
}

@media (max-width: 768px) {
  .upload-container {
    padding: 0 0.5rem;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  .mode-selection {
    flex-direction: column;
    align-items: center;
  }
  
  .mode-btn {
    width: 100%;
    max-width: 300px;
  }
  
  .upload-form, .upload-guidelines {
    padding: 1.5rem;
  }
}

@media (prefers-color-scheme: dark) {
  .upload-page {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  }
  
  .upload-form, .upload-guidelines {
    background: var(--color-surface-dark);
  }
  
  .mode-btn {
    background: var(--color-surface-dark);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-dark);
  }
  
  .form-group input {
    background: var(--color-background-dark);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-dark);
  }
  
  .api-info {
    background: rgba(59, 130, 246, 0.1);
  }
  
  .api-info pre {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style>