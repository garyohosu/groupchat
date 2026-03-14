// Quora できるかなラボ グループチャット - Frontend Application

// State management
const state = {
  currentUser: null,
  currentView: 'login', // 'login', 'register', 'chat', 'profile', 'admin'
  messages: [],
  users: [],
  pollingInterval: null,
  lastUpdateTime: null
}

// API client
const api = {
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'エラーが発生しました')
      }

      return data
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  },

  async register(loginId, displayName, password, passwordConfirm) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ loginId, displayName, password, passwordConfirm })
    })
  },

  async login(loginId, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ loginId, password })
    })
  },

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' })
  },

  async getMe() {
    return this.request('/api/me')
  },

  async updateProfile(displayName, bio) {
    return this.request('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ displayName, bio })
    })
  },

  async changePassword(currentPassword, newPassword, newPasswordConfirm) {
    return this.request('/api/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirm })
    })
  },

  async getMessages(roomId = 1, before = null) {
    const url = before
      ? `/api/messages?roomId=${roomId}&before=${before}`
      : `/api/messages?roomId=${roomId}`
    return this.request(url)
  },

  async getMessageChanges(roomId = 1, since) {
    return this.request(`/api/messages/changes?roomId=${roomId}&since=${encodeURIComponent(since)}`)
  },

  async sendMessage(roomId, body) {
    return this.request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId, body })
    })
  },

  async deleteMessage(id) {
    return this.request(`/api/messages/${id}`, { method: 'DELETE' })
  },

  async getUsers() {
    return this.request('/api/users')
  },

  async getAdminUsers() {
    return this.request('/api/admin/users')
  },

  async toggleUserStatus(userId, isActive) {
    return this.request(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    })
  },

  async adminDeleteMessage(id) {
    return this.request(`/api/admin/messages/${id}`, { method: 'DELETE' })
  }
}

// View rendering functions
const views = {
  renderLogin() {
    return `
      <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-400 to-green-600 px-4">
        <div class="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div class="text-center mb-8">
            <i class="fas fa-comments text-green-500 text-5xl mb-4"></i>
            <h1 class="text-2xl font-bold text-gray-800">できるかなラボ</h1>
            <p class="text-gray-600 mt-2">グループチャット</p>
          </div>
          
          <form id="loginForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
              <input type="text" id="loginId" required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="ログインID">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input type="password" id="password" required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="パスワード">
            </div>
            
            <div id="loginError" class="text-red-500 text-sm hidden"></div>
            
            <button type="submit"
              class="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200 font-medium">
              ログイン
            </button>
          </form>
          
          <div class="mt-6 text-center">
            <button onclick="app.showRegister()" class="text-green-600 hover:text-green-700 text-sm">
              アカウントを作成
            </button>
          </div>
        </div>
      </div>
    `
  },

  renderRegister() {
    return `
      <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-400 to-green-600 px-4">
        <div class="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div class="text-center mb-8">
            <i class="fas fa-user-plus text-green-500 text-5xl mb-4"></i>
            <h1 class="text-2xl font-bold text-gray-800">新規登録</h1>
          </div>
          
          <form id="registerForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
              <input type="text" id="regLoginId" required pattern="[a-zA-Z0-9_.-]{3,20}"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="3〜20文字の半角英数字">
              <p class="text-xs text-gray-500 mt-1">半角英数字、アンダースコア、ハイフン、ドットのみ</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">表示名</label>
              <input type="text" id="regDisplayName" required maxlength="20"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="1〜20文字">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input type="password" id="regPassword" required minlength="8" maxlength="128"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="8〜128文字">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">パスワード確認</label>
              <input type="password" id="regPasswordConfirm" required minlength="8" maxlength="128"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="パスワード再入力">
            </div>
            
            <div id="registerError" class="text-red-500 text-sm hidden"></div>
            
            <button type="submit"
              class="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200 font-medium">
              登録
            </button>
          </form>
          
          <div class="mt-6 text-center">
            <button onclick="app.showLogin()" class="text-green-600 hover:text-green-700 text-sm">
              ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>
    `
  },

  renderChat() {
    const isAdmin = state.currentUser?.role === 'admin'
    
    return `
      <div class="flex flex-col h-screen bg-gray-100">
        <!-- Header -->
        <div class="bg-green-500 text-white p-4 shadow-lg">
          <div class="max-w-4xl mx-auto flex justify-between items-center">
            <div>
              <h1 class="text-xl font-bold flex items-center">
                <i class="fas fa-comments mr-2"></i>
                できるかなラボ
              </h1>
              <p class="text-sm opacity-90">メンバー: <span id="memberCount">-</span>人</p>
            </div>
            <div class="flex gap-2">
              ${isAdmin ? '<button onclick="app.showAdmin()" class="bg-white text-green-600 px-3 py-1 rounded text-sm hover:bg-gray-100"><i class="fas fa-shield-alt mr-1"></i>管理</button>' : ''}
              <button onclick="app.showProfile()" class="bg-white text-green-600 px-3 py-1 rounded text-sm hover:bg-gray-100">
                <i class="fas fa-user mr-1"></i>プロフィール
              </button>
              <button onclick="app.logout()" class="bg-white text-green-600 px-3 py-1 rounded text-sm hover:bg-gray-100">
                <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
              </button>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div id="messagesContainer" class="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div class="max-w-4xl mx-auto">
            <div id="loadMore" class="text-center mb-4 hidden">
              <button onclick="app.loadMoreMessages()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 text-sm">
                過去のメッセージを読み込む
              </button>
            </div>
            <div id="messagesList"></div>
          </div>
        </div>

        <!-- Input -->
        <div class="bg-white border-t border-gray-200 p-4 shadow-lg">
          <div class="max-w-4xl mx-auto">
            <form id="messageForm" class="flex gap-2">
              <textarea id="messageInput" rows="1" maxlength="500" required
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent message-input"
                placeholder="メッセージを入力..." style="max-height: 100px;"></textarea>
              <button type="submit"
                class="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition duration-200">
                <i class="fas fa-paper-plane"></i>
              </button>
            </form>
            <div class="text-xs text-gray-500 mt-1 text-right">
              <span id="charCount">0</span> / 500文字
            </div>
          </div>
        </div>
      </div>
    `
  },

  renderProfile() {
    const user = state.currentUser
    
    return `
      <div class="min-h-screen bg-gray-100 py-8 px-4">
        <div class="max-w-2xl mx-auto">
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-800">
                <i class="fas fa-user-circle mr-2"></i>プロフィール
              </h2>
              <button onclick="app.showChat()" class="text-green-600 hover:text-green-700">
                <i class="fas fa-times text-2xl"></i>
              </button>
            </div>
            
            <form id="profileForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
                <input type="text" value="${user.loginId}" disabled
                  class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">表示名</label>
                <input type="text" id="profileDisplayName" value="${user.displayName}" required maxlength="20"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">自己紹介</label>
                <textarea id="profileBio" rows="3" maxlength="160"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="自己紹介を入力（160文字以内）">${user.bio || ''}</textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">登録日</label>
                <input type="text" value="${new Date(user.createdAt).toLocaleDateString('ja-JP')}" disabled
                  class="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
              </div>
              
              <div id="profileError" class="text-red-500 text-sm hidden"></div>
              <div id="profileSuccess" class="text-green-500 text-sm hidden"></div>
              
              <button type="submit"
                class="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200 font-medium">
                プロフィール更新
              </button>
            </form>

            <hr class="my-6">

            <form id="passwordForm" class="space-y-4">
              <h3 class="text-lg font-semibold text-gray-800">パスワード変更</h3>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
                <input type="password" id="currentPassword" required minlength="8" maxlength="128"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
                <input type="password" id="newPassword" required minlength="8" maxlength="128"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
                <input type="password" id="newPasswordConfirm" required minlength="8" maxlength="128"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
              </div>

              <div id="passwordError" class="text-red-500 text-sm hidden"></div>
              <div id="passwordSuccess" class="text-green-500 text-sm hidden"></div>

              <button type="submit"
                class="w-full bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-600 transition duration-200 font-medium">
                パスワードを変更
              </button>
            </form>
          </div>
        </div>
      </div>
    `
  },

  renderAdmin() {
    return `
      <div class="min-h-screen bg-gray-100 py-8 px-4">
        <div class="max-w-6xl mx-auto">
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold text-gray-800">
                <i class="fas fa-shield-alt mr-2"></i>管理画面
              </h2>
              <button onclick="app.showChat()" class="text-green-600 hover:text-green-700">
                <i class="fas fa-times text-2xl"></i>
              </button>
            </div>
            
            <div class="mb-6">
              <h3 class="text-lg font-semibold mb-3">ユーザー管理</h3>
              <div id="adminUsersList" class="space-y-2"></div>
            </div>
          </div>
        </div>
      </div>
    `
  }
}

// Application logic
const app = {
  async init() {
    try {
      const data = await api.getMe()
      state.currentUser = data
      this.showChat()
      await this.loadMessages()
      this.startPolling()
    } catch (error) {
      this.showLogin()
    }
  },

  render() {
    const appEl = document.getElementById('app')
    
    switch (state.currentView) {
      case 'login':
        appEl.innerHTML = views.renderLogin()
        this.attachLoginHandlers()
        break
      case 'register':
        appEl.innerHTML = views.renderRegister()
        this.attachRegisterHandlers()
        break
      case 'chat':
        appEl.innerHTML = views.renderChat()
        this.attachChatHandlers()
        this.renderMessages()
        this.updateMemberCount()
        break
      case 'profile':
        appEl.innerHTML = views.renderProfile()
        this.attachProfileHandlers()
        break
      case 'admin':
        appEl.innerHTML = views.renderAdmin()
        this.loadAdminUsers()
        break
    }
  },

  showLogin() {
    state.currentView = 'login'
    this.stopPolling()
    this.render()
  },

  showRegister() {
    state.currentView = 'register'
    this.render()
  },

  showChat() {
    state.currentView = 'chat'
    this.render()
  },

  showProfile() {
    state.currentView = 'profile'
    this.render()
  },

  showAdmin() {
    state.currentView = 'admin'
    this.render()
  },

  attachLoginHandlers() {
    const form = document.getElementById('loginForm')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      
      const loginId = document.getElementById('loginId').value
      const password = document.getElementById('password').value
      const errorEl = document.getElementById('loginError')
      
      try {
        const data = await api.login(loginId, password)
        state.currentUser = data.user
        this.showChat()
        await this.loadMessages()
        this.startPolling()
      } catch (error) {
        errorEl.textContent = error.message
        errorEl.classList.remove('hidden')
      }
    })
  },

  attachRegisterHandlers() {
    const form = document.getElementById('registerForm')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      
      const loginId = document.getElementById('regLoginId').value
      const displayName = document.getElementById('regDisplayName').value
      const password = document.getElementById('regPassword').value
      const passwordConfirm = document.getElementById('regPasswordConfirm').value
      const errorEl = document.getElementById('registerError')
      
      try {
        const data = await api.register(loginId, displayName, password, passwordConfirm)
        state.currentUser = data.user
        this.showChat()
        await this.loadMessages()
        this.startPolling()
      } catch (error) {
        errorEl.textContent = error.message
        errorEl.classList.remove('hidden')
      }
    })
  },

  attachChatHandlers() {
    const form = document.getElementById('messageForm')
    const input = document.getElementById('messageInput')
    const charCount = document.getElementById('charCount')
    
    input.addEventListener('input', () => {
      charCount.textContent = input.value.length
      input.style.height = 'auto'
      input.style.height = input.scrollHeight + 'px'
    })
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      
      const body = input.value.trim()
      if (!body) return
      
      try {
        await api.sendMessage(1, body)
        input.value = ''
        charCount.textContent = '0'
        input.style.height = 'auto'
        // Message will appear via polling
      } catch (error) {
        alert(error.message)
      }
    })
  },

  attachProfileHandlers() {
    const form = document.getElementById('profileForm')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      
      const displayName = document.getElementById('profileDisplayName').value
      const bio = document.getElementById('profileBio').value
      const errorEl = document.getElementById('profileError')
      const successEl = document.getElementById('profileSuccess')
      
      try {
        const data = await api.updateProfile(displayName, bio)
        state.currentUser = data.user
        
        successEl.textContent = 'プロフィールを更新しました'
        successEl.classList.remove('hidden')
        errorEl.classList.add('hidden')
        
        setTimeout(() => {
          successEl.classList.add('hidden')
        }, 3000)
      } catch (error) {
        errorEl.textContent = error.message
        errorEl.classList.remove('hidden')
        successEl.classList.add('hidden')
      }
    })

    const pwForm = document.getElementById('passwordForm')
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault()

      const currentPassword = document.getElementById('currentPassword').value
      const newPassword = document.getElementById('newPassword').value
      const newPasswordConfirm = document.getElementById('newPasswordConfirm').value
      const errorEl = document.getElementById('passwordError')
      const successEl = document.getElementById('passwordSuccess')

      try {
        await api.changePassword(currentPassword, newPassword, newPasswordConfirm)
        pwForm.reset()
        successEl.textContent = 'パスワードを変更しました'
        successEl.classList.remove('hidden')
        errorEl.classList.add('hidden')
        setTimeout(() => {
          successEl.classList.add('hidden')
        }, 3000)
      } catch (error) {
        errorEl.textContent = error.message
        errorEl.classList.remove('hidden')
        successEl.classList.add('hidden')
      }
    })
  },

  async loadMessages() {
    try {
      const data = await api.getMessages(1)
      state.messages = data.messages
      state.lastUpdateTime = new Date().toISOString()
      
      const loadMoreBtn = document.getElementById('loadMore')
      if (data.hasMore && loadMoreBtn) {
        loadMoreBtn.classList.remove('hidden')
      }
      
      this.renderMessages()
      this.scrollToBottom()
    } catch (error) {
      console.error('Load messages error:', error)
    }
  },

  async loadMoreMessages() {
    if (state.messages.length === 0) return
    
    try {
      const oldestId = state.messages[0].id
      const data = await api.getMessages(1, oldestId)
      
      state.messages = [...data.messages, ...state.messages]
      
      const loadMoreBtn = document.getElementById('loadMore')
      if (!data.hasMore && loadMoreBtn) {
        loadMoreBtn.classList.add('hidden')
      }
      
      this.renderMessages()
    } catch (error) {
      console.error('Load more messages error:', error)
    }
  },

  renderMessages() {
    const listEl = document.getElementById('messagesList')
    if (!listEl) return
    
    listEl.innerHTML = state.messages.map(msg => this.renderMessage(msg)).join('')
    
    // Attach delete handlers
    state.messages.forEach(msg => {
      const deleteBtn = document.getElementById(`delete-${msg.id}`)
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteMessage(msg.id))
      }
    })
  },

  renderMessage(msg) {
    const isOwn = msg.userId === state.currentUser?.id
    const isAdmin = state.currentUser?.role === 'admin'
    const canDelete = isOwn || isAdmin
    
    const displayBody = msg.isDeleted ? 'このメッセージは削除されました' : msg.body
    const time = new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    
    if (isOwn) {
      return `
        <div class="flex justify-end mb-3">
          <div class="chat-bubble">
            <div class="bg-green-500 text-white rounded-lg px-4 py-2 ${msg.isDeleted ? 'italic opacity-70' : ''}">
              <div class="break-words">${this.escapeHtml(displayBody)}</div>
              <div class="text-xs opacity-80 mt-1 flex justify-between items-center">
                <span>${time}</span>
                ${canDelete && !msg.isDeleted ? `<button id="delete-${msg.id}" class="ml-2 hover:text-red-200"><i class="fas fa-trash-alt"></i></button>` : ''}
              </div>
            </div>
          </div>
        </div>
      `
    } else {
      return `
        <div class="flex justify-start mb-3">
          <div class="chat-bubble">
            <div class="text-xs text-gray-600 mb-1 font-medium">${this.escapeHtml(msg.displayName)}</div>
            <div class="bg-white border border-gray-200 rounded-lg px-4 py-2 ${msg.isDeleted ? 'italic opacity-70' : ''}">
              <div class="break-words">${this.escapeHtml(displayBody)}</div>
              <div class="text-xs text-gray-500 mt-1 flex justify-between items-center">
                <span>${time}</span>
                ${isAdmin && !msg.isDeleted ? `<button id="delete-${msg.id}" class="ml-2 text-red-600 hover:text-red-800"><i class="fas fa-trash-alt"></i></button>` : ''}
              </div>
            </div>
          </div>
        </div>
      `
    }
  },

  async deleteMessage(id) {
    if (!confirm('このメッセージを削除しますか?')) return
    
    try {
      await api.deleteMessage(id)
      // Update will be reflected via polling
    } catch (error) {
      alert(error.message)
    }
  },

  startPolling() {
    this.stopPolling()
    
    state.pollingInterval = setInterval(async () => {
      if (state.currentView !== 'chat') return
      
      try {
        const data = await api.getMessageChanges(1, state.lastUpdateTime)
        
        if (data.messages && data.messages.length > 0) {
          // Update existing messages or add new ones
          data.messages.forEach(newMsg => {
            const index = state.messages.findIndex(m => m.id === newMsg.id)
            if (index >= 0) {
              state.messages[index] = newMsg
            } else {
              state.messages.push(newMsg)
            }
          })
          
          state.lastUpdateTime = new Date().toISOString()
          this.renderMessages()
          
          // Auto scroll if near bottom
          const container = document.getElementById('messagesContainer')
          if (container) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
            if (isNearBottom) {
              this.scrollToBottom()
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 3000)
  },

  stopPolling() {
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval)
      state.pollingInterval = null
    }
  },

  scrollToBottom() {
    const container = document.getElementById('messagesContainer')
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight
      }, 100)
    }
  },

  async updateMemberCount() {
    try {
      const data = await api.getUsers()
      const countEl = document.getElementById('memberCount')
      if (countEl) {
        countEl.textContent = data.users.length
      }
    } catch (error) {
      console.error('Update member count error:', error)
    }
  },

  async loadAdminUsers() {
    try {
      const data = await api.getAdminUsers()
      const listEl = document.getElementById('adminUsersList')
      
      listEl.innerHTML = data.users.map(user => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
          <div>
            <div class="font-medium">${this.escapeHtml(user.displayName)}</div>
            <div class="text-sm text-gray-600">ID: ${this.escapeHtml(user.loginId)} | 役割: ${user.role === 'admin' ? '管理者' : '一般'}</div>
            <div class="text-xs text-gray-500">登録: ${new Date(user.createdAt).toLocaleDateString('ja-JP')}</div>
          </div>
          <div>
            ${user.role !== 'admin' ? `
              <button onclick="app.toggleUserStatus(${user.id}, ${user.isActive === 1 ? 0 : 1})"
                class="px-3 py-1 rounded text-sm ${user.isActive === 1 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}">
                ${user.isActive === 1 ? '停止' : '有効化'}
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')
    } catch (error) {
      console.error('Load admin users error:', error)
    }
  },

  async toggleUserStatus(userId, isActive) {
    try {
      await api.toggleUserStatus(userId, isActive)
      await this.loadAdminUsers()
    } catch (error) {
      alert(error.message)
    }
  },

  async logout() {
    try {
      await api.logout()
      state.currentUser = null
      state.messages = []
      this.showLogin()
    } catch (error) {
      console.error('Logout error:', error)
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  app.init()
})
