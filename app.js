// ============================================================
// iOS PWA VIEWPORT HEIGHT FIX
// On iOS Standalone mode, 100vh includes the status bar.
// We measure window.innerHeight which gives the TRUE visible
// height, and set it as a CSS custom property --real-vh.
// Usage in CSS: height: calc(var(--real-vh, 1vh) * 100);
// ============================================================
function setRealVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--real-vh', `${vh}px`);
}
setRealVH();
window.addEventListener('resize', setRealVH);
window.addEventListener('orientationchange', function() {
  setTimeout(setRealVH, 300); // wait for browser chrome to settle
});

// GLOBAL ERROR HANDLER FOR EASY PWA DEBUGGING ON MOBILE
window.onerror = function(message, source, lineno, colno, error) {
  alert(`Error: ${message}\nLine: ${lineno}\nSource: ${source}`);
  return false;
};

// APP STATE
let state = {
  db: null,
  isFirebaseInitialized: false,
  allVocab: [],  // Master list of all vocabulary downloaded from DB
  vocabList: [], // Active vocabulary list for current topic or study session
  currentTopic: '',
  stats: { total: 0, remembered: 0, learning: 0, unlearned: 0 },
  
  // Pagination details for topic deck explorer
  topicPagination: {
    currentPage: 1,
    itemsPerPage: 20
  },
  
  statusPagination: {
    currentPage: 1,
    itemsPerPage: 20
  },
  
  // Temporary list storing words in current list view for instant search
  tempWordsList: [],
  tempFilterType: 'all',
  
  // Passive Autoplay study state
  passive: {
    isPlaying: false,
    currentIndex: 0,
    timer: null,
    settings: {
      repeats: 1,      // Repeat count for word/sentence
      flipDelay: 2,    // Seconds before flipping card to show meaning
      nextDelay: 3,    // Seconds before moving to next card
      isRandom: false, // Random order vs sequential
      speakWord: true,
      speakSentence: false, // Turned off examples pronunciation
      speakMeaning: true
    },
    currentVoiceCycle: 0,
    audioTimeout: null
  },
  
  // Active Swiping study state
  activeSwipe: {
    cards: [],
    currentIndex: 0
  },
  
  // Matching Game state
  matchGame: {
    deItems: [],
    viItems: [],
    selectedDe: null,
    selectedVi: null,
    matchedCount: 0,
    xp: 0
  },
  
  // Listening Game state
  listeningGame: {
    currentWord: null,
    options: [],
    hasAnswered: false,
    correctCount: 0,
    totalQuestions: 10,
    currentQuestionIndex: 0
  },
  
  // Sprint Game state
  sprintGame: {
    score: 0,
    combo: 0,
    maxCombo: 0,
    timeLeft: 60,
    timerInterval: null,
    currentWord: null,
    options: []
  },
  
  // Sentence Fill-in Game state
  fillBlankGame: {
    currentWord: null,
    options: [],
    hasAnswered: false,
    correctCount: 0,
    totalQuestions: 0,
    currentQuestionIndex: 0,
    questions: []
  },
  
  // Mixed Challenge Game state
  mixedGame: {
    currentWord: null,
    options: [],
    hasAnswered: false,
    correctCount: 0,
    totalQuestions: 0,
    currentQuestionIndex: 0,
    questions: []
  }
};

// MOCK LOCAL DATA (Initial seed if Firebase offline)
const DEFAULT_VOCAB_DATA = [
  // Family
  { id: "m1", word: "der Vater", ipa: "deːɐ̯ ˈfaːtɐ", meaning_en: "father", sentence: "Mein Vater arbeitet als Ingenieur.", sentence_meaning: "My father works as an engineer.", topic: "Family", status: "new" },
  { id: "m2", word: "die Mutter", ipa: "diː ˈmʊtɐ", meaning_en: "mother", sentence: "Meine Mutter kocht sehr gern.", sentence_meaning: "Meine Mutter likes to cook very much.", topic: "Family", status: "new" },
  { id: "m3", word: "der Sohn", ipa: "deːɐ̯ zoːn", meaning_en: "son", sentence: "Ihr Sohn geht schon zur Schule.", sentence_meaning: "Her son is already going to school.", topic: "Family", status: "new" },
  { id: "m4", word: "die Tochter", ipa: "diː ˈtɔxtɐ", meaning_en: "daughter", sentence: "Sie haben eine kleine Tochter.", sentence_meaning: "They have a small daughter.", topic: "Family", status: "new" },
  { id: "m5", word: "die Geschwister", ipa: "diː ɡəˈʃvɪstɐ", meaning_en: "siblings", sentence: "Hast du Geschwister?", sentence_meaning: "Do you have siblings?", topic: "Family", status: "new" },
  { id: "m6", word: "die Eltern", ipa: "diː ˈɛltɐn", meaning_en: "parents", sentence: "Meine Eltern wohnen in Berlin.", sentence_meaning: "My parents live in Berlin.", topic: "Family", status: "new" },

  // Socializing
  { id: "m7", word: "Anschluss finden", ipa: "ˈanʃlʊs ˈfɪndn̩", meaning_en: "to settle in, to make contact, to connect", sentence: "Es fällt ihm schwer, in der neuen Stadt schnell Anschluss zu finden.", sentence_meaning: "He finds it difficult to settle in quickly in the new city.", topic: "Socializing", status: "new" },
  { id: "m8", word: "sich vorstellen", ipa: "zɪç ˈfoːɐ̯ˌʃtɛlən", meaning_en: "to introduce oneself", sentence: "Erzählen Sie uns bitte etwas über sich und stellen Sie sich vor.", sentence_meaning: "Please tell us something about yourself and introduce yourself.", topic: "Socializing", status: "new" },
  { id: "m9", word: "begrüßen", ipa: "bəˈɡʁyːsn̩", meaning_en: "to greet, to welcome", sentence: "Der Direktor begrüßte die Gäste.", sentence_meaning: "The director welcomed the guests.", topic: "Socializing", status: "new" },
  { id: "m10", word: "sich verabschieden", ipa: "zɪç fɛɐ̯ˈʔapʃiːdn̩", meaning_en: "to say goodbye", sentence: "Wir müssen uns leider schon verabschieden.", sentence_meaning: "Unfortunately, we have to say goodbye already.", topic: "Socializing", status: "new" },
  { id: "m11", word: "das Gespräch", ipa: "das ɡəˈʃpʁɛːç", meaning_en: "conversation, talk", sentence: "Ich hatte ein nettes Gespräch mit meinem Nachbarn.", sentence_meaning: "I had a nice conversation with my neighbor.", topic: "Socializing", status: "new" },

  // Shopping
  { id: "m12", word: "einkaufen", ipa: "ˈaɪ̯nˌkaʊ̯fn̩", meaning_en: "to shop, to go shopping", sentence: "Samstags gehen wir immer einkaufen.", sentence_meaning: "We always go shopping on Saturdays.", topic: "Shopping", status: "new" },
  { id: "m13", word: "günstig", ipa: "ˈɡʏnstɪç", meaning_en: "cheap, favorable, reasonable", sentence: "Dieses Angebot ist sehr günstig.", sentence_meaning: "This offer is very reasonable.", topic: "Shopping", status: "new" },
  { id: "m14", word: "teuer", ipa: "ˈtɔʏ̯ɐ", meaning_en: "expensive", sentence: "Das Auto ist mir zu teuer.", sentence_meaning: "The car is too expensive for me.", topic: "Shopping", status: "new" },
  { id: "m15", word: "die Quittung", ipa: "diː ˈkvɪtʊŋ", meaning_en: "receipt", sentence: "Brauchen Sie eine Quittung?", sentence_meaning: "Do you need a receipt.", topic: "Shopping", status: "new" },
  { id: "m16", word: "umtauschen", ipa: "ˈʊmˌtaʊ̯ʃn̩", meaning_en: "to exchange, to return", sentence: "Kann ich dieses Hemd umtauschen?", sentence_meaning: "Can I exchange this shirt.", topic: "Shopping", status: "new" },

  // Travel
  { id: "m17", word: "die Fahrkarte", ipa: "diː ˈfaːɐ̯ˌkaʁtə", meaning_en: "ticket, transit ticket", sentence: "Ich muss noch eine Fahrkarte kaufen.", sentence_meaning: "Ich muss noch eine Fahrkarte kaufen.", topic: "Travel", status: "new" },
  { id: "m18", word: "der Bahnhof", ipa: "deːɐ̯ ˈbaːnˌhoːf", meaning_en: "train station", sentence: "Wo ist der Bahnhof?", sentence_meaning: "Where is the train station.", topic: "Travel", status: "new" },
  { id: "m19", word: "das Hotel", ipa: "das hoˈtɛl", meaning_en: "hotel", sentence: "Wir haben ein Zimmer im Hotel gebucht.", sentence_meaning: "We booked a room in the hotel.", topic: "Travel", status: "new" },
  { id: "m20", word: "besichtigen", ipa: "bə·zɪçtɪɡn̩", meaning_en: "to sightsee, to visit, to inspect", sentence: "Morgen besichtigen wir die Altstadt.", sentence_meaning: "Tomorrow we will sightsee the old town.", topic: "Travel", status: "new" },
  { id: "m21", word: "die Verspätung", ipa: "diː fɛɐ̯ˈpeːtʊŋ", meaning_en: "delay", sentence: "Der Zug hat leider 20 Minuten Verspätung.", sentence_meaning: "Unfortunately, the train has a 20-minute delay.", topic: "Travel", status: "new" }
];

// INIT APPLICATION
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  setupEventListeners();
  initSVGIcons();
  
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch((err) => console.log('Service Worker Registration Failed: ', err));
  }
});

// FIREBASE INITIALIZATION & FALLBACK
function initFirebase() {
  const config = {
    databaseURL: "https://deutschc12026-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "deutschc12026"
  };
  
  try {
    firebase.initializeApp(config);
    state.db = firebase.database();
    state.isFirebaseInitialized = true;
    
    // Fetch all database entries ONCE
    state.db.ref('vocab').once('value')
      .then((snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Object.keys(val).map(key => ({ id: key, ...val[key] }));
          state.allVocab = list;
          updateStatsFromList(list);
        } else {
          // Database is empty, seed it
          seedDefaultDataToFirebase();
        }
        
        // Load stats from Firebase before initializing user stats dashboard
        loadStatsFromDB(() => {
          initUserStats();
        });
      })
      .catch(err => {
        console.error('Firebase read error on init:', err);
        loadLocalFallback();
      });
  } catch (err) {
    console.error('Firebase startup error:', err);
    loadLocalFallback();
  }
}

// Fallback to local storage
function loadLocalFallback() {
  console.log('Running in Local Offline Mode.');
  
  let localDb = localStorage.getItem('local_vocab');
  if (!localDb) {
    localStorage.setItem('local_vocab', JSON.stringify(DEFAULT_VOCAB_DATA));
    localDb = JSON.stringify(DEFAULT_VOCAB_DATA);
  }
  
  const list = JSON.parse(localDb);
  state.allVocab = list;
  updateStatsFromList(list);
  
  // Initialize user stats locally immediately
  initUserStats();
}

// Seed default vocab to Firebase if database is completely empty
function seedDefaultDataToFirebase() {
  if (!state.isFirebaseInitialized || !state.db) return;
  
  const updates = {};
  DEFAULT_VOCAB_DATA.forEach(item => {
    updates['vocab/' + item.id] = {
      word: item.word,
      ipa: item.ipa,
      meaning_en: item.meaning_en,
      sentence: item.sentence,
      sentence_meaning: item.sentence_meaning,
      topic: item.topic,
      status: item.status
    };
  });
  
  state.db.ref().update(updates)
    .then(() => {
      console.log('Seeded default German-English vocabulary to Firebase');
      state.db.ref('vocab').once('value').then(snap => {
        const val = snap.val();
        if (val) {
          const list = Object.keys(val).map(key => ({ id: key, ...val[key] }));
          state.allVocab = list;
          updateStatsFromList(list);
        }
      });
    })
    .catch(err => console.error('Failed to seed default vocabulary:', err));
}

// FETCH DATA FOR ACTIVE TOPIC (Reads from memory allVocab)
function fetchTopicVocab(topicName, callback) {
  state.currentTopic = topicName;
  state.vocabList = state.allVocab.filter(item => (item.topic || 'General') === topicName);
  callback(state.vocabList);
}

// UPDATE WORD STATUS IN DB
function updateWordStatus(wordId, newStatus) {
  const word = state.vocabList.find(item => item.id === wordId);
  if (word) {
    word.status = newStatus;
  }
  
  const masterWord = state.allVocab.find(item => item.id === wordId);
  if (masterWord) {
    masterWord.status = newStatus;
  }
  
  if (state.isFirebaseInitialized && state.db) {
    state.db.ref('vocab/' + wordId).update({ status: newStatus })
      .then(() => {
        console.log(`Updated word status ${wordId} to ${newStatus}`);
        updateStatsFromList(state.allVocab);
      })
      .catch(err => console.error('Firebase update error:', err));
  } else {
    localStorage.setItem('local_vocab', JSON.stringify(state.allVocab));
    updateStatsFromList(state.allVocab);
  }
  
  if (newStatus === 'learning' || newStatus === 'remembered') {
    recordWordLearnedAction(wordId);
  }
}

// DELETE WORD FROM DATABASE
function deleteWord(wordId) {
  state.vocabList = state.vocabList.filter(item => item.id !== wordId);
  state.allVocab = state.allVocab.filter(item => item.id !== wordId);
  
  if (state.isFirebaseInitialized && state.db) {
    state.db.ref('vocab/' + wordId).remove()
      .then(() => {
        console.log(`Deleted word ${wordId} from Firebase`);
        updateStatsFromList(state.allVocab);
        
        // Handle pagination check if we delete the last item of the page
        const totalPages = Math.ceil(state.vocabList.length / state.topicPagination.itemsPerPage);
        if (state.topicPagination.currentPage > totalPages && totalPages > 0) {
          state.topicPagination.currentPage = totalPages;
        }
        
        renderTopicWords();
      })
      .catch(err => console.error('Firebase delete error:', err));
  } else {
    localStorage.setItem('local_vocab', JSON.stringify(state.allVocab));
    updateStatsFromList(state.allVocab);
    
    const totalPages = Math.ceil(state.vocabList.length / state.topicPagination.itemsPerPage);
    if (state.topicPagination.currentPage > totalPages && totalPages > 0) {
      state.topicPagination.currentPage = totalPages;
    }
    
    renderTopicWords();
  }
}

// RECALCULATE STATISTICS
function loadStats() {
  if (state.isFirebaseInitialized && state.db) {
    state.db.ref('vocab').once('value').then((snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        state.allVocab = list;
        updateStatsFromList(list);
      }
    }).catch(err => {
      console.error('Stats reload failed:', err);
    });
  } else {
    loadLocalFallback();
  }
}

function updateStatsFromList(list) {
  state.stats = {
    total: list.length,
    remembered: list.filter(item => item.status === 'remembered').length,
    learning: list.filter(item => item.status === 'learning').length,
    unlearned: list.filter(item => item.status === 'not_memorized' || item.status === 'new' || !item.status).length
  };
  
  document.getElementById('stat-total').textContent = state.stats.total;
  document.getElementById('stat-remembered').textContent = state.stats.remembered;
  document.getElementById('stat-learning').textContent = state.stats.learning;
  document.getElementById('stat-unlearned').textContent = state.stats.unlearned;
  
  renderTopics();
  updateUserStatsDashboard();
}

// RENDER TOPICS LIST DYNAMICALLY
function renderTopics() {
  if (!state.allVocab) return;
  
  const uniqueTopics = [...new Set(state.allVocab.map(item => item.topic || 'General'))];
  
  const emojiMap = {
    'Family': '👪',
    'Gia đình': '👪',
    'Socializing': '💬',
    'Giao tiếp': '💬',
    'Shopping': '🛒',
    'Mua sắm': '🛒',
    'Travel': '✈️',
    'Du lịch': '✈️',
    'General': '📝',
    'Food': '🍎',
    'Work': '💼',
    'Health': '🏥',
    'Education': '🏫'
  };
  
  const grid = document.getElementById('topics-grid');
  grid.innerHTML = '';
  
  uniqueTopics.forEach(topicName => {
    const list = state.allVocab.filter(item => (item.topic || 'General') === topicName);
    const total = list.length;
    const remembered = list.filter(item => item.status === 'remembered').length;
    const percentage = total > 0 ? (remembered / total) * 100 : 0;
    const emoji = emojiMap[topicName] || '📖';
    
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <div>
        <div class="topic-icon">${emoji}</div>
        <div class="topic-name">${topicName}</div>
      </div>
      <div>
        <div class="topic-count">${remembered}/${total} remembered</div>
        <div class="topic-progress-bar">
          <div class="topic-progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      openTopicDashboard(topicName);
    });
    
    grid.appendChild(card);
  });
}

// NAVIGATION / ROUTER
function showPage(pageId) {
  stopAudioPlayback();
  
  if (state.passive.timer) {
    clearTimeout(state.passive.timer);
    state.passive.timer = null;
  }
  if (state.passive.audioTimeout) {
    clearTimeout(state.passive.audioTimeout);
  }
  state.passive.isPlaying = false;
  
  if (state.sprintGame.timerInterval) {
    clearInterval(state.sprintGame.timerInterval);
    state.sprintGame.timerInterval = null;
  }

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const activePage = document.getElementById(pageId);
  if (activePage) {
    activePage.classList.add('active');
  }
  
  const bottomNav = document.getElementById('bottom-nav');
  const mainTabs = ['vocab-page', 'grammar-page', 'lesson-page', 'test-page', 'topic-dashboard-page'];
  if (bottomNav) {
    if (mainTabs.includes(pageId)) {
      bottomNav.style.display = 'flex';
    } else {
      bottomNav.style.display = 'none';
    }
  }
}

// SETUP DOM EVENTS
function setupEventListeners() {
  // Bottom Tab Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const tab = item.getAttribute('data-tab');
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      if (tab === 'vocab') {
        showPage('vocab-page');
        loadStats();
      } else if (tab === 'grammar') {
        showPage('grammar-page');
        // Set active segment URL to iframe initially if not loaded yet
        const activeBtn = document.querySelector('.grammar-selector .segment-btn.active');
        const iframe = document.getElementById('grammar-iframe');
        if (activeBtn && iframe && !iframe.src) {
          iframe.src = activeBtn.getAttribute('data-url');
        }
      } else if (tab === 'lesson') {
        showPage('lesson-page');
      } else if (tab === 'test') {
        showPage('test-page');
      }
    });
  });
  
  // Grammar tab segment selector click listener
  const grammarSelector = document.querySelector('.grammar-selector');
  if (grammarSelector) {
    grammarSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-btn');
      if (btn) {
        grammarSelector.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const url = btn.getAttribute('data-url');
        const iframe = document.getElementById('grammar-iframe');
        if (iframe) iframe.src = url;
      }
    });
  }
  
  // Stat box click triggers to load status-filtered words
  document.querySelector('.stat-box.all').addEventListener('click', () => {
    openWordsListPage('all', 'All Words');
  });
  document.querySelector('.stat-box.remembered').addEventListener('click', () => {
    openWordsListPage('remembered', 'Remembered Words');
  });
  document.querySelector('.stat-box.learning').addEventListener('click', () => {
    openWordsListPage('learning', 'Learning List');
  });
  document.querySelector('.stat-box.unlearned').addEventListener('click', () => {
    openWordsListPage('unlearned', 'Unlearned Words');
  });
  


  // Main screen search across all decks
  document.getElementById('main-vocab-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const resultsSection = document.getElementById('main-search-results-section');
    const decksSection = document.getElementById('decks-section');
    
    if (term === '') {
      resultsSection.style.display = 'none';
      decksSection.style.display = 'block';
      document.getElementById('main-search-results-container').innerHTML = '';
    } else {
      resultsSection.style.display = 'block';
      decksSection.style.display = 'none';
      
      const filtered = state.allVocab.filter(item => 
        (item.word || '').toLowerCase().includes(term) || 
        (item.meaning_en || item.meaning || item.meaning_vn || '').toLowerCase().includes(term)
      );
      
      // Sort results alphabetically
      filtered.sort((a, b) => (a.word || '').localeCompare(b.word || ''));
      renderMainSearchResults(filtered);
    }
  });
  
  // MODAL CLOSE
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
  
  // Back button headers
  document.querySelectorAll('.back-btn[data-back-to]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const parentPage = btn.closest('.page');
      if (parentPage && [
        'passive-study-page', 
        'active-study-page', 
        'matching-game-page', 
        'listening-game-page', 
        'sprint-game-page',
        'fill-blank-game-page',
        'mixed-game-page'
      ].includes(parentPage.id)) {
        e.preventDefault();
        goBackFromStudy();
      } else {
        const pageId = btn.getAttribute('data-back-to');
        showPage(pageId);
      }
    });
  });
  
  // Tap to flip passive flashcard
  const passiveCard = document.getElementById('passive-flashcard');
  if (passiveCard) {
    passiveCard.addEventListener('click', (e) => {
      // Don't flip if clicking interactive children like textarea, buttons, or list items
      if (
        e.target.closest('textarea') || 
        e.target.closest('button') || 
        e.target.closest('.audio-btn') || 
        e.target.closest('li')
      ) {
        return;
      }
      passiveCard.classList.toggle('flipped');
      
      // Auto audio play on flip (German on front, English on back)
      const isFlipped = passiveCard.classList.contains('flipped');
      const word = state.vocabList[state.passive.currentIndex];
      if (word) {
        if (isFlipped) {
          speakTranslationSequence(word);
        } else {
          const wordText = word.word || word.id || '';
          speakText(wordText, 'de-DE');
        }
      }
    });
  }
  
  // Passive Autoplay settings modal controls
  document.getElementById('btn-passive-settings').addEventListener('click', () => {
    // Sync UI with current state values
    const repeats = state.passive.settings.repeats;
    document.querySelectorAll('#passive-settings-modal .repeats-segment .segment-btn').forEach(btn => {
      if (parseInt(btn.getAttribute('data-value')) === repeats) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    document.getElementById('passive-flip-delay').value = state.passive.settings.flipDelay;
    document.getElementById('passive-next-delay').value = state.passive.settings.nextDelay;
    
    const isRandom = state.passive.settings.isRandom;
    document.querySelectorAll('#passive-settings-modal .order-segment .segment-btn').forEach(btn => {
      const val = btn.getAttribute('data-value');
      if ((isRandom && val === 'random') || (!isRandom && val === 'sequence')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    openModal('passive-settings-modal');
  });
  
  document.getElementById('passive-settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Save settings
    state.passive.settings.repeats = parseInt(document.querySelector('#passive-settings-modal .repeats-segment .active').getAttribute('data-value'));
    state.passive.settings.flipDelay = parseFloat(document.getElementById('passive-flip-delay').value);
    state.passive.settings.nextDelay = parseFloat(document.getElementById('passive-next-delay').value);
    
    // Save order
    const orderBtn = document.querySelector('#passive-settings-modal .order-segment .active');
    state.passive.settings.isRandom = orderBtn.getAttribute('data-value') === 'random';
    
    closeModal('passive-settings-modal');
    
    // Reset/Apply new settings immediately without losing user's current card position
    const currentWord = state.vocabList[state.passive.currentIndex];
    
    // Re-load list based on isRandom setting
    state.vocabList = getActiveStudyWords();
    if (state.passive.settings.isRandom) {
      state.vocabList.sort(() => Math.random() - 0.5);
    } else {
      state.vocabList.sort((a,b) => (a.id || '').localeCompare(b.id || ''));
    }
    
    // Find the index of the word we were on, so we don't jump cards
    if (currentWord) {
      const newIdx = state.vocabList.findIndex(item => item.id === currentWord.id);
      if (newIdx !== -1) {
        state.passive.currentIndex = newIdx;
      } else {
        state.passive.currentIndex = 0;
      }
    } else {
      state.passive.currentIndex = 0;
    }
    
    renderPassiveCard();
    
    // Reset play cycle with new settings if playing
    if (state.passive.isPlaying) {
      stopAudioPlayback();
      if (state.passive.timer) clearTimeout(state.passive.timer);
      if (state.passive.audioTimeout) clearTimeout(state.passive.audioTimeout);
      runPassiveAutoplayStep();
    }
  });
  
  // Segment button click selectors (for modals)
  document.querySelectorAll('.segment-control').forEach(segment => {
    segment.addEventListener('click', (e) => {
      if (e.target.classList.contains('segment-btn')) {
        segment.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
      }
    });
  });
  
  // sticky Top Footer click bindings for Topic Dashboard
  document.getElementById('btn-passive-direct').addEventListener('click', () => {
    if (state.vocabList.length === 0) {
      alert('This topic is empty!');
      return;
    }
    startPassiveStudy();
  });
  
  document.getElementById('btn-active-menu').addEventListener('click', () => {
    if (state.vocabList.length === 0) {
      alert('This topic is empty!');
      return;
    }
    openModal('active-modes-modal');
  });
  
  // Modal Choose active modes click bindings
  document.getElementById('modal-mode-swipe').addEventListener('click', () => {
    closeModal('active-modes-modal');
    startActiveSwipeStudy();
  });
  
  document.getElementById('modal-mode-match').addEventListener('click', () => {
    if (state.vocabList.length < 2) {
      alert('Need at least 2 words to play Word Match!');
      return;
    }
    closeModal('active-modes-modal');
    startMatchingGame();
  });
  
  document.getElementById('modal-mode-listening').addEventListener('click', () => {
    if (state.vocabList.length < 4) {
      alert('Need at least 4 words to play Listening Game!');
      return;
    }
    closeModal('active-modes-modal');
    startListeningGame();
  });
  
  document.getElementById('modal-mode-sprint').addEventListener('click', () => {
    if (state.vocabList.length < 4) {
      alert('Need at least 4 words to play Word Sprint!');
      return;
    }
    closeModal('active-modes-modal');
    startSprintGame();
  });
  
  document.getElementById('modal-mode-fillblank').addEventListener('click', () => {
    // Verify vocabulary size
    if (state.vocabList.length < 2) {
      alert('Need at least 2 words to play Sentence Fill-in!');
      return;
    }
    closeModal('active-modes-modal');
    startFillBlankGame();
  });
  
  document.getElementById('modal-mode-mixed').addEventListener('click', () => {
    // Verify vocabulary size
    if (state.vocabList.length < 2) {
      alert('Need at least 2 words to play Mixed Challenge!');
      return;
    }
    closeModal('active-modes-modal');
    startMixedGame();
  });
  
  // Click on Streak box on dashboard opens Streak Garden Modal
  const streakBox = document.getElementById('dashboard-streak-box');
  if (streakBox) {
    streakBox.addEventListener('click', () => {
      openStreakGardenModal();
    });
  }
  
  // Click on Daily Task button starts study session
  const startDailyBtn = document.getElementById('btn-start-daily-task');
  if (startDailyBtn) {
    startDailyBtn.addEventListener('click', () => {
      const task = DailyTaskService.getTodayTask();
      if (task && task.is_completed) {
        alert("You have completed today's task! Come back tomorrow!");
        return;
      }
      startDailyTaskSwipeStudy();
    });
  }
}

// -------------------------------------------------------------
// TOPIC DETAIL DASHBOARD (LIST EXPLORER + PAGINATION)
// -------------------------------------------------------------
// UNIFIED WORD EXPLORER ROUTING (DRY Design)
function openTopicDashboard(topicName) {
  openWordExplorer('topic', topicName, topicName);
}

function openWordsListPage(filterType, titleText) {
  let queryValue = filterType;
  openWordExplorer(filterType, queryValue, titleText);
}

function openWordExplorer(filterType, queryValue, titleText) {
  state.currentTopic = titleText;
  state.topicPagination.currentPage = 1; // Reset to page 1
  
  state.tempFilterType = filterType; // 'topic', 'all', 'remembered', 'learning', 'unlearned'
  state.tempQueryValue = queryValue; // e.g. 'Gia đình' or 'remembered'
  
  let filtered = [];
  if (filterType === 'topic') {
    filtered = state.allVocab.filter(item => (item.topic || 'General') === queryValue);
  } else if (filterType === 'all') {
    filtered = [...state.allVocab];
  } else if (filterType === 'remembered') {
    filtered = state.allVocab.filter(item => item.status === 'remembered');
  } else if (filterType === 'learning') {
    filtered = state.allVocab.filter(item => item.status === 'learning');
  } else if (filterType === 'unlearned') {
    filtered = state.allVocab.filter(item => item.status === 'not_memorized' || item.status === 'new' || !item.status);
  }
  
  // Sort by ID to preserve database sequence
  filtered.sort((a,b) => (a.id || '').localeCompare(b.id || ''));
  
  // Load words into active study list
  state.vocabList = [...filtered];
  
  // Dynamic study back target is always the word explorer itself
  state.studySourcePage = 'topic-dashboard-page';
  updateBackButtonsTarget();
  
  document.getElementById('topic-title-dashboard').textContent = titleText;
  document.getElementById('topic-desc-dashboard').textContent = `${filtered.length} words`;
  
  renderTopicWords();
  showPage('topic-dashboard-page');
}

function renderTopicWords() {
  const container = document.getElementById('topic-words-container');
  container.innerHTML = '';
  
  const list = [...state.vocabList];
  const totalItems = list.length;
  
  if (totalItems === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary); font-size: 14px;">
        No words found.
      </div>
    `;
    document.getElementById('topic-pagination-container').innerHTML = '';
    return;
  }
  
  // Calculate paging slices (20 items per page)
  const itemsPerPage = state.topicPagination.itemsPerPage;
  const currentPage = state.topicPagination.currentPage;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageItems = list.slice(startIndex, endIndex);
  
  pageItems.forEach(word => {
    const row = document.createElement('div');
    row.className = 'topic-word-item';
    row.style.cursor = 'pointer';
    
    const wordText = word.word || word.id || '';
    
    let meaningText = '';
    const vn = word.meaning_vn || word.meaning || '';
    const en = word.meaning_en || '';
    if (vn && en) {
      meaningText = `${vn} (${en})`;
    } else {
      meaningText = vn || en || '';
    }
    
    let dotClass = '';
    if (word.status === 'remembered') dotClass = 'remembered';
    else if (word.status === 'learning') dotClass = 'learning';
    else dotClass = 'unlearned'; // new, not_memorized, undefined
    
    row.innerHTML = `
      <div class="topic-word-left">
        <span class="row-speaker" style="color: #9CA3AF; font-size: 14px; flex-shrink: 0; margin-right: 4px;">🔊</span>
        <div class="topic-word-details">
          <div class="topic-word-spelling">${wordText}</div>
          <div class="topic-word-meaning">${meaningText}</div>
        </div>
      </div>
      <div class="topic-word-right">
        <div class="status-dot ${dotClass}" style="width: 10px; height: 10px;" title="Cycle status (Tap to toggle)"></div>
      </div>
    `;
    
    // Play pronunciation only when clicking the speaker icon
    const speakerBtn = row.querySelector('.row-speaker');
    if (speakerBtn) {
      speakerBtn.style.padding = '4px 8px'; // Expand clickable area slightly
      speakerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(wordText, 'de-DE');
      });
    }
    
    // Single click row to open static flashcard view
    row.addEventListener('click', () => {
      openSingleWordFlashcard(word, pageItems);
    });
    
    // Cycle status on dot tap (Unlearned -> Learning -> Remembered -> Unlearned)
    const dot = row.querySelector('.status-dot');
    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // Stop audio playback on status click
      let nextStatus = 'new';
      if (word.status === 'new' || word.status === 'not_memorized' || !word.status) {
        nextStatus = 'learning';
      } else if (word.status === 'learning') {
        nextStatus = 'remembered';
      } else if (word.status === 'remembered') {
        nextStatus = 'not_memorized';
      }
      
      updateWordStatus(word.id, nextStatus);
      
      // Auto refresh list from database and re-evaluate list context after short timeout
      setTimeout(() => {
        let updatedList = [];
        if (state.tempFilterType === 'topic') {
          updatedList = state.allVocab.filter(item => (item.topic || 'General') === state.tempQueryValue);
        } else if (state.tempFilterType === 'all') {
          updatedList = [...state.allVocab];
        } else if (state.tempFilterType === 'remembered') {
          updatedList = state.allVocab.filter(item => item.status === 'remembered');
        } else if (state.tempFilterType === 'learning') {
          updatedList = state.allVocab.filter(item => item.status === 'learning');
        } else if (state.tempFilterType === 'unlearned') {
          updatedList = state.allVocab.filter(item => item.status === 'not_memorized' || item.status === 'new' || !item.status);
        }
        
        updatedList.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        state.vocabList = [...updatedList];
        
        // Safety check pagination
        const totalPages = Math.ceil(updatedList.length / state.topicPagination.itemsPerPage);
        if (state.topicPagination.currentPage > totalPages && totalPages > 0) {
          state.topicPagination.currentPage = totalPages;
        }
        
        document.getElementById('topic-desc-dashboard').textContent = `${updatedList.length} words`;
        renderTopicWords();
      }, 200);
    });
    
    container.appendChild(row);
  });
  
  // Render pagination buttons in footer
  renderTopicPagination(totalItems);
}

function renderTopicPagination(totalItems) {
  const container = document.getElementById('topic-pagination-container');
  container.innerHTML = '';
  
  // Custom flex styling for the row
  container.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px; padding: 0 4px;';
  
  const footer = document.querySelector('.topic-dashboard-footer');
  const scrollContainer = document.getElementById('topic-words-container');
  
  const itemsPerPage = state.topicPagination.itemsPerPage;
  const currentPage = state.topicPagination.currentPage;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  if (footer) footer.style.display = 'flex';
  if (scrollContainer) scrollContainer.style.paddingBottom = '56px';
  
  // 1. Left side buttons container (Prev / Next arrows + Indicator)
  const navContainer = document.createElement('div');
  navContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  // Back arrow button
  const prevBtn = document.createElement('button');
  prevBtn.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
  prevBtn.style.cssText = 'width: 36px; height: 36px; border-radius: 12px; border: 1px solid var(--border-color); background: #F3F4F6; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9CA3AF; margin: 0; box-shadow: var(--shadow-sm);';
  if (currentPage !== 1) {
    prevBtn.style.color = '#1F2937';
    prevBtn.style.background = '#FFFFFF';
  }
  prevBtn.innerHTML = '←';
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      state.topicPagination.currentPage--;
      renderTopicWords();
      document.getElementById('topic-words-container').scrollTop = 0;
    }
  });
  navContainer.appendChild(prevBtn);
  
  // 2. Page indicator pill (e.g. 1/4) in the middle
  const pillIndicator = document.createElement('div');
  pillIndicator.style.cssText = 'background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 14px; padding: 8px 16px; font-size: 13px; font-weight: 700; color: #1F2937; box-shadow: var(--shadow-sm); min-width: 60px; text-align: center;';
  pillIndicator.textContent = `${currentPage}/${totalPages}`;
  navContainer.appendChild(pillIndicator);
  
  // Forward arrow button
  const nextBtn = document.createElement('button');
  nextBtn.className = `page-btn ${currentPage === totalPages ? 'disabled' : ''}`;
  nextBtn.style.cssText = 'width: 36px; height: 36px; border-radius: 12px; border: 1px solid var(--border-color); background: #F3F4F6; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9CA3AF; margin: 0; box-shadow: var(--shadow-sm);';
  if (currentPage !== totalPages) {
    nextBtn.style.color = '#1F2937';
    nextBtn.style.background = '#FFFFFF';
  }
  nextBtn.innerHTML = '→';
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      state.topicPagination.currentPage++;
      renderTopicWords();
      document.getElementById('topic-words-container').scrollTop = 0;
    }
  });
  navContainer.appendChild(nextBtn);
  
  container.appendChild(navContainer);
  
  // 3. Right side dropdown size selector
  const selectWrapper = document.createElement('div');
  
  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'custom-select-page-size';
  sizeSelect.style.cssText = `
    background-color: #FFFFFF;
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    color: #1F2937;
    outline: none;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%231f2937' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
    box-shadow: var(--shadow-sm);
  `;
  
  const sizes = [20, 40, 60, 80, 100, 200];
  sizes.forEach(size => {
    const opt = document.createElement('option');
    opt.value = size;
    opt.textContent = `${size} Word/page`;
    if (size === itemsPerPage) opt.selected = true;
    sizeSelect.appendChild(opt);
  });
  
  sizeSelect.addEventListener('change', (e) => {
    const newSize = parseInt(e.target.value);
    state.topicPagination.itemsPerPage = newSize;
    state.topicPagination.currentPage = 1; // Reset to page 1
    renderTopicWords();
    document.getElementById('topic-words-container').scrollTop = 0;
  });
  
  selectWrapper.appendChild(sizeSelect);
  container.appendChild(selectWrapper);
}

// -------------------------------------------------------------
// TEXT TO SPEECH SERVICE — iOS-safe Web Speech API only
// Google TTS is blocked by CORS on iOS PWA; always use SpeechSynthesis
// -------------------------------------------------------------

// Pre-load voices as soon as possible
window._cachedVoices = [];
function loadVoices() {
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) window._cachedVoices = v;
}
loadVoices();
if (window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function speakText(text, lang, onEndCallback) {
  // Stop any in-progress speech
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.onended = null;
    window.currentAudio.onerror = null;
    window.currentAudio = null;
  }

  const cleanText = (text || '').toString().trim();
  if (!cleanText) {
    if (onEndCallback) onEndCallback();
    return;
  }

  // On iOS, Google TTS is always blocked by CORS. Use Web Speech API directly.
  speakWebSpeech(cleanText, lang, onEndCallback);
}

function findFemaleVoice(voices, lang) {
  const langKey = lang.toLowerCase().split('-')[0];
  const candidateVoices = voices.filter(v => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang.startsWith(langKey) || vLang.startsWith(lang.toLowerCase());
  });

  if (candidateVoices.length === 0) return null;

  const maleKeywords = ['stefan', 'yannick', 'david', 'george', 'daniel', 'mark', 'ravi', 'male', 'dschamil', 'stefano', 'pavel', 'richard', 'shawn'];
  const femaleKeywords = ['katja', 'hedda', 'gisela', 'zira', 'hazel', 'samantha', 'susan', 'karen', 'elena', 'female', 'an', 'linh', 'lan', 'chi', 'google', 'microsoft'];

  const bestFemale = candidateVoices.find(v => {
    const name = v.name.toLowerCase();
    return femaleKeywords.some(kw => name.includes(kw)) && !maleKeywords.some(kw => name.includes(kw));
  });
  if (bestFemale) return bestFemale;

  const neutral = candidateVoices.find(v => !maleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
  if (neutral) return neutral;

  return candidateVoices[0];
}

// Core speak using Web Speech API — fully synchronous for iOS PWA compatibility.
// iOS REQUIRES speechSynthesis.speak() to be called in the same synchronous
// call stack as the user gesture. Never defer it to setTimeout or Promise.
function speakWebSpeech(text, lang, onEndCallback) {
  if (!window.speechSynthesis) {
    if (onEndCallback) onEndCallback();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.85;
  utterance.volume = 1.0;

  // Use whatever voices are available NOW (synchronous — no waiting)
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    window._cachedVoices = voices;
  }
  const allVoices = window._cachedVoices || [];
  const voice = findFemaleVoice(allVoices, lang);
  if (voice) utterance.voice = voice;

  utterance.onend = () => { if (onEndCallback) onEndCallback(); };
  utterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e.error);
    if (onEndCallback) onEndCallback();
  };

  // Speak SYNCHRONOUSLY — must be within user gesture call stack on iOS
  window.speechSynthesis.speak(utterance);

  // iOS bug: speechSynthesis can stall if another tab was active
  // Resume it after a tiny delay if it paused itself
  setTimeout(function() {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 100);
}

function stopAudioPlayback() {
  window.speechSynthesis.cancel();
  if (window.speechSequenceTimeout) {
    clearTimeout(window.speechSequenceTimeout);
    window.speechSequenceTimeout = null;
  }
  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.onended = null;
    window.currentAudio.onerror = null;
    window.currentAudio = null;
  }
}

// Pre-fetch voices
window.speechSynthesis.getVoices();
if (window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function speakFlashcardSequence(word) {
  stopAudioPlayback();
  
  const deText = word.word || '';
  const enText = word.meaning_en || '';
  
  let noteText = '';
  if (word.note) {
    if (Array.isArray(word.note)) {
      noteText = word.note.join('. ');
    } else if (typeof word.note === 'string') {
      noteText = word.note;
    }
  }
  
  if (deText) {
    speakText(deText, 'de-DE', () => {
      window.speechSequenceTimeout = setTimeout(() => {
        if (enText) {
          speakText(enText, 'en-US', () => {
            window.speechSequenceTimeout = setTimeout(() => {
              if (noteText && noteText.trim() !== '') {
                speakText(noteText, 'vi-VN');
              }
            }, 600);
          });
        } else if (noteText && noteText.trim() !== '') {
          speakText(noteText, 'vi-VN');
        }
      }, 600);
    });
  }
}

window.speakFlashcardSequenceById = function(wordId) {
  const word = state.allVocab.find(item => item.id === wordId);
  if (word) {
    const card = document.getElementById('passive-flashcard');
    const isFlipped = card && card.classList.contains('flipped');
    if (isFlipped) {
      speakFlashcardSequence(word);
    } else {
      speakText(word.word || word.id, 'de-DE');
    }
  }
};

function speakTranslationSequence(word) {
  stopAudioPlayback();
  const enText = word.meaning_en || '';
  let noteText = '';
  if (word.note) {
    if (Array.isArray(word.note)) {
      noteText = word.note.join('. ');
    } else if (typeof word.note === 'string') {
      noteText = word.note;
    }
  }
  
  if (enText) {
    speakText(enText, 'en-US', () => {
      window.speechSequenceTimeout = setTimeout(() => {
        if (noteText && noteText.trim() !== '') {
          speakText(noteText, 'vi-VN');
        }
      }, 600);
    });
  } else if (noteText && noteText.trim() !== '') {
    speakText(noteText, 'vi-VN');
  }
}

function renderMainSearchResults(list) {
  const container = document.getElementById('main-search-results-container');
  container.innerHTML = '';
  
  document.getElementById('main-search-results-title').textContent = `Search Results (${list.length} words)`;
  
  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary); font-size: 14px;">
        No words found.
      </div>
    `;
    return;
  }
  
  list.forEach(word => {
    const row = document.createElement('div');
    row.className = 'topic-word-item';
    row.style.cursor = 'pointer';
    
    const wordText = word.word || word.id || '';
    
    let meaningText = '';
    const vn = word.meaning_vn || word.meaning || '';
    const en = word.meaning_en || '';
    if (vn && en) {
      meaningText = `${vn} (${en})`;
    } else {
      meaningText = vn || en || '';
    }
    
    let dotClass = '';
    if (word.status === 'remembered') dotClass = 'remembered';
    else if (word.status === 'learning') dotClass = 'learning';
    else dotClass = 'unlearned'; // new, not_memorized, undefined
    
    row.innerHTML = `
      <div class="topic-word-left">
        <span class="row-speaker" style="color: #9CA3AF; font-size: 14px; flex-shrink: 0; margin-right: 4px;">🔊</span>
        <div class="topic-word-details">
          <div class="topic-word-spelling">${wordText}</div>
          <div class="topic-word-meaning">${meaningText}</div>
        </div>
      </div>
      <div class="topic-word-right">
        <div class="status-dot ${dotClass}" style="width: 10px; height: 10px;" title="Cycle status (Tap to toggle)"></div>
      </div>
    `;
    
    // Play pronunciation only when clicking the speaker icon
    const speakerBtn = row.querySelector('.row-speaker');
    if (speakerBtn) {
      speakerBtn.style.padding = '4px 8px'; // Expand clickable area slightly
      speakerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(wordText, 'de-DE');
      });
    }
    
    // Single click row to open static flashcard view
    row.addEventListener('click', () => {
      openSingleWordFlashcard(word, list);
    });
    
    const dot = row.querySelector('.status-dot');
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      let nextStatus = 'new';
      if (word.status === 'new' || word.status === 'not_memorized' || !word.status) {
        nextStatus = 'learning';
      } else if (word.status === 'learning') {
        nextStatus = 'remembered';
      } else if (word.status === 'remembered') {
        nextStatus = 'not_memorized';
      }
      
      updateWordStatus(word.id, nextStatus);
      
      setTimeout(() => {
        // Re-filter main search
        const term = document.getElementById('main-vocab-search').value.toLowerCase().trim();
        if (term) {
          const filtered = state.allVocab.filter(item => 
            (item.word || '').toLowerCase().includes(term) || 
            (item.meaning_en || item.meaning || item.meaning_vn || '').toLowerCase().includes(term)
          );
          filtered.sort((a, b) => (a.word || '').localeCompare(b.word || ''));
          renderMainSearchResults(filtered);
        }
      }, 200);
    });
    
    container.appendChild(row);
  });
}

// -------------------------------------------------------------
// MODE 1: PASSIVE FLASHCARD STUDY (AUTOPLAY + SPEECH LOOPS)
// -------------------------------------------------------------
function startPassiveStudy() {
  state.passive.currentIndex = 0;
  state.passive.isPlaying = false;
  
  // Slice list to active page words
  state.vocabList = getActiveStudyWords();
  
  if (state.passive.settings.isRandom) {
    state.vocabList.sort(() => Math.random() - 0.5);
  } else {
    state.vocabList.sort((a,b) => (a.id || '').localeCompare(b.id || ''));
  }
  
  showPage('passive-study-page');
  document.getElementById('passive-topic-title').textContent = state.currentTopic;
  
  renderPassiveCard();
  
  const btnPlay = document.getElementById('btn-passive-play');
  const btnPrev = document.getElementById('btn-passive-prev');
  const btnNext = document.getElementById('btn-passive-next');
  
  btnPlay.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  
  const newPlay = btnPlay.cloneNode(true);
  const newPrev = btnPrev.cloneNode(true);
  const newNext = btnNext.cloneNode(true);
  btnPlay.parentNode.replaceChild(newPlay, btnPlay);
  btnPrev.parentNode.replaceChild(newPrev, btnPrev);
  btnNext.parentNode.replaceChild(newNext, btnNext);
  
  newPlay.addEventListener('click', () => {
    if (state.passive.isPlaying) {
      pausePassiveStudy();
    } else {
      playPassiveStudy();
    }
  });
  
  newPrev.addEventListener('click', () => {
    navigatePassiveCard(-1);
  });
  
  newNext.addEventListener('click', () => {
    navigatePassiveCard(1);
  });
  
  const statusBtn = document.getElementById('passive-status-badge');
  const newStatusBtn = statusBtn.cloneNode(true);
  statusBtn.parentNode.replaceChild(newStatusBtn, statusBtn);
  newStatusBtn.addEventListener('click', () => {
    const word = state.vocabList[state.passive.currentIndex];
    const newStatus = word.status === 'remembered' ? 'new' : 'remembered';
    updateWordStatus(word.id, newStatus);
    updatePassiveStatusBadge(newStatus);
  });
}

function getTypeBadgeHTML(type) {
  if (!type) return '';
  const val = type.toLowerCase();
  let bg = '#F3F4F6';
  let color = '#374151';
  if (val.includes('der') || val.includes('masculine')) {
    bg = '#E0F2FE';
    color = '#0369A1';
  } else if (val.includes('die') || val.includes('feminine')) {
    bg = '#FCE7F3';
    color = '#BE185D';
  } else if (val.includes('das') || val.includes('neuter')) {
    bg = '#D1FAE5';
    color = '#047857';
  }
  return `<span class="word-type-badge" style="display: inline-block; background: ${bg}; color: ${color}; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px; margin: 4px auto 0 auto; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(0,0,0,0.05);">${type}</span>`;
}

function formatCardMeanings(word) {
  const vn = word.meaning_vn || word.meaning || '';
  const en = word.meaning_en || '';
  if (vn && en) {
    return `
      <div class="word-meaning" style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">${vn}</div>
      <div class="word-meaning-en" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; font-style: italic;">(${en})</div>
    `;
  } else {
    const fallback = vn || en || 'No meaning';
    return `<div class="word-meaning" style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px;">${fallback}</div>`;
  }
}

function getWordFamilyHTML(word_family) {
  if (!word_family) return '';
  let items = [];
  if (Array.isArray(word_family)) {
    items = word_family;
  } else if (typeof word_family === 'string') {
    if (word_family.includes('–')) {
      items = word_family.split('–').map(item => item.trim());
    } else if (word_family.includes('-')) {
      items = word_family.split('-').map(item => item.trim());
    } else if (word_family.includes(',')) {
      items = word_family.split(',').map(item => item.trim());
    } else {
      items = [word_family.trim()];
    }
  }
  
  if (items.length === 0) return '';
  return `
    <div class="card-section-title" style="margin-top: 12px;">Word Family</div>
    <ul class="card-list-items">
      ${items.map(f => `<li>${f}</li>`).join('')}
    </ul>
  `;
}

function renderPassiveCard() {
  const word = state.vocabList[state.passive.currentIndex];
  const total = state.vocabList.length;
  
  document.getElementById('passive-progress-text').textContent = `${state.passive.currentIndex + 1} / ${total}`;
  document.getElementById('passive-progress-fill').style.width = `${((state.passive.currentIndex + 1) / total) * 100}%`;
  
  const card = document.getElementById('passive-flashcard');
  card.classList.remove('flipped');
  
  const wordText = word.word || word.id || 'Unknown Word';
  const sentenceMeaningText = word.sentence_meaning || word.sentence_vi || '';
  
  // Render Image
  const imgContainer = document.getElementById('passive-image-container');
  if (word.image && word.image.trim() !== '') {
    imgContainer.style.display = 'block';
    imgContainer.innerHTML = `
      <div class="card-image-container" style="margin-bottom: 10px; max-height: 110px; overflow: hidden; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; width: 100%;">
        <img src="${word.image}" style="max-width: 100%; max-height: 110px; object-fit: contain; border-radius: 6px;">
      </div>
    `;
  } else {
    imgContainer.style.display = 'none';
    imgContainer.innerHTML = '';
  }
  
  // Type Badge
  const typeBadgeHTML = getTypeBadgeHTML(word.type);
  
  document.getElementById('passive-word-de').innerHTML = `
    ${typeBadgeHTML}
    <div style="font-size: 24px; font-weight: 800; color: var(--text-primary); margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      ${wordText} 
      <button class="audio-btn" onclick="speakFlashcardSequenceById('${word.id}')">🔊</button>
    </div>
  `;
  
  // IPA with safe formatting
  let ipaText = word.ipa || '';
  if (ipaText && !ipaText.startsWith('[')) {
    ipaText = `[${ipaText}]`;
  }
  document.getElementById('passive-ipa-de').textContent = ipaText;
  
  // Example Sentence
  let sentenceHTML = '';
  if (word.sentence) {
    sentenceHTML = `${word.sentence} <button class="audio-btn" onclick="speakText('${word.sentence.replace(/'/g, "\\'")}', 'de-DE')">🔊</button>`;
  }
  document.getElementById('passive-sentence-de').innerHTML = sentenceHTML;
  
  // Meanings
  document.getElementById('passive-meaning-vi').innerHTML = formatCardMeanings(word);
  document.getElementById('passive-sentence-vi').textContent = sentenceMeaningText;
  
  // Word Family
  const familyContainer = document.getElementById('passive-family-container');
  familyContainer.innerHTML = getWordFamilyHTML(word.word_family);
  
  // Notes
  const noteContainer = document.getElementById('passive-note-container');
  renderNotesSection(word, noteContainer, () => {
    renderPassiveCard();
  });
  
  updatePassiveStatusBadge(word.status);
  
  // Auto audio play on first load or manual navigation (if autoplay is OFF)
  if (!state.passive.isPlaying && wordText) {
    speakText(word.word || word.id, 'de-DE');
  }
}

function updatePassiveStatusBadge(status) {
  const badge = document.getElementById('passive-status-badge');
  if (status === 'remembered') {
    badge.className = 'status-toggle-btn active';
    badge.innerHTML = '✔️ Remembered';
  } else {
    badge.className = 'status-toggle-btn';
    badge.innerHTML = '⏳ Unlearned';
  }
}

function navigatePassiveCard(dir) {
  stopAudioPlayback();
  if (state.passive.timer) clearTimeout(state.passive.timer);
  if (state.passive.audioTimeout) clearTimeout(state.passive.audioTimeout);
  
  state.passive.currentIndex += dir;
  if (state.passive.currentIndex < 0) {
    state.passive.currentIndex = state.vocabList.length - 1;
  } else if (state.passive.currentIndex >= state.vocabList.length) {
    state.passive.currentIndex = 0;
  }
  
  renderPassiveCard();
  
  if (state.passive.isPlaying) {
    runPassiveAutoplayStep();
  }
}

function playPassiveStudy() {
  state.passive.isPlaying = true;
  document.getElementById('btn-passive-play').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';
  document.getElementById('autoplay-status-label').textContent = 'Autoplay: ON';
  runPassiveAutoplayStep();
}

function pausePassiveStudy() {
  state.passive.isPlaying = false;
  document.getElementById('btn-passive-play').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  document.getElementById('autoplay-status-label').textContent = 'Autoplay: OFF';
  stopAudioPlayback();
  if (state.passive.timer) clearTimeout(state.passive.timer);
  if (state.passive.audioTimeout) clearTimeout(state.passive.audioTimeout);
}

// PASSIVE AUTOPLAY SEQUENTIAL STEP
function runPassiveAutoplayStep() {
  if (!state.passive.isPlaying) return;
  
  const wordObj = state.vocabList[state.passive.currentIndex];
  let speakSequence = [];
  
  const wordText = wordObj.word || wordObj.id || '';
  const meaningText = wordObj.meaning_en || wordObj.meaning || wordObj.meaning_vn || '';
  
  // Word repetition in German
  if (state.passive.settings.speakWord && wordText) {
    for (let i = 0; i < state.passive.settings.repeats; i++) {
      speakSequence.push({ text: wordText, lang: 'de-DE' });
    }
  }
  
  let speakIndex = 0;
  
  function playNextVoice() {
    if (!state.passive.isPlaying) return;
    
    if (speakIndex < speakSequence.length) {
      const task = speakSequence[speakIndex];
      speakIndex++;
      speakText(task.text, task.lang, () => {
        state.passive.audioTimeout = setTimeout(playNextVoice, 500);
      });
    } else {
      // German audio sequence done. Wait for flip delay, then flip card
      state.passive.timer = setTimeout(() => {
        if (!state.passive.isPlaying) return;
        
        // Flip card visually
        document.getElementById('passive-flashcard').classList.add('flipped');
        
        // Read English translation (only once)
        if (state.passive.settings.speakMeaning && meaningText) {
          speakText(meaningText, 'en-US', () => {
            state.passive.audioTimeout = setTimeout(readNoteIfPresent, 500);
          });
        } else {
          readNoteIfPresent();
        }
        
        function readNoteIfPresent() {
          if (!state.passive.isPlaying) return;
          let noteText = '';
          if (wordObj.note) {
            if (Array.isArray(wordObj.note)) {
              noteText = wordObj.note.join('. ');
            } else if (typeof wordObj.note === 'string') {
              noteText = wordObj.note;
            }
          }
          if (noteText && noteText.trim() !== '') {
            speakText(noteText, 'vi-VN', () => {
              goToNextCardAfterDelay();
            });
          } else {
            goToNextCardAfterDelay();
          }
        }
      }, state.passive.settings.flipDelay * 1000);
    }
  }
  
  function goToNextCardAfterDelay() {
    state.passive.timer = setTimeout(() => {
      if (!state.passive.isPlaying) return;
      navigatePassiveCard(1);
    }, state.passive.settings.nextDelay * 1000);
  }
  
  playNextVoice();
}

// -------------------------------------------------------------
// MODE 2: ACTIVE FLASHCARD STUDY (SWIPE INTERACTION)
// -------------------------------------------------------------
function startActiveSwipeStudy() {
  state.activeSwipe.currentIndex = 0;
  state.activeSwipe.isDailyTaskMode = false;
  
  // Use sliced page list
  state.vocabList = getActiveStudyWords();
  let activeList = [...state.vocabList];
  
  state.activeSwipe.cards = activeList.sort(() => Math.random() - 0.5);
  
  showPage('active-study-page');
  renderSwipeCardStack();
}

function renderSwipeCardStack() {
  const container = document.getElementById('active-swipe-container');
  container.innerHTML = '';
  
  const total = state.activeSwipe.cards.length;
  const currIndex = state.activeSwipe.currentIndex;
  
  document.getElementById('active-progress-text').textContent = `${currIndex} / ${total} thẻ`;
  document.getElementById('active-progress-fill').style.width = `${(currIndex / total) * 100}%`;
  
  if (currIndex >= total) {
    let title = "Hoàn thành chủ đề! 🎉";
    let desc = "Bạn đã ôn tập tất cả các thẻ trong bộ này.";
    if (state.activeSwipe.isDailyTaskMode) {
      title = "Nhiệm vụ hoàn thành! 🎉";
      desc = "Bạn đã hoàn thành các thẻ trong Daily Task hôm nay. Xem lại tiến độ của bạn tại trang chủ!";
    }
    
    container.innerHTML = `
      <div class="game-result-container">
        <div class="result-icon">🎉</div>
        <div class="result-title">${title}</div>
        <p style="margin-bottom: 24px;">${desc}</p>
        <button class="btn-primary" onclick="goBackFromStudy()">Quay lại</button>
      </div>
    `;
    return;
  }
  
  // Auto-speak top card word in German when rendered
  const topCard = state.activeSwipe.cards[currIndex];
  speakText(topCard.word, 'de-DE');
  
  const itemsToRender = state.activeSwipe.cards.slice(currIndex, currIndex + 2).reverse();
  
  itemsToRender.forEach((word, indexInRenderSlice) => {
    const isTop = indexInRenderSlice === itemsToRender.length - 1;
    const cardEl = document.createElement('div');
    cardEl.className = 'swipe-card';
    cardEl.style.zIndex = indexInRenderSlice + 10;
    
    const wordText = word.word || word.id || '';
    const sentenceMeaningText = word.sentence_meaning || word.sentence_vi || '';
    
    // Type Badge
    const typeBadgeHTML = getTypeBadgeHTML(word.type);
    
    // Render Image
    let imageHTML = '';
    if (word.image && word.image.trim() !== '') {
      imageHTML = `
        <div class="card-image-container" style="margin-bottom: 10px; max-height: 100px; overflow: hidden; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; width: 100%;">
          <img src="${word.image}" style="max-width: 100%; max-height: 100px; object-fit: contain; border-radius: 6px;">
        </div>
      `;
    }
    
    // IPA with safe formatting
    let ipaText = word.ipa || '';
    if (ipaText && !ipaText.startsWith('[')) {
      ipaText = `[${ipaText}]`;
    }
    
    // Word Family
    const familyHTML = getWordFamilyHTML(word.word_family);
    
    // Combined Meanings
    const meaningsHTML = formatCardMeanings(word);
    
    cardEl.innerHTML = `
      <div class="swipe-indicator right">Đã nhớ</div>
      <div class="swipe-indicator left">Chưa thuộc</div>
      <div class="swipe-indicator up">Đang học</div>
      
      ${imageHTML}
      ${typeBadgeHTML}
      
      <div class="word-display" style="margin-top: 4px;">${wordText} <button class="audio-btn" data-audio="${wordText}">🔊</button></div>
      <div class="word-ipa">${ipaText}</div>
      <div class="word-sentence">${word.sentence || ''}</div>
      
      <div class="card-inner-meaning" style="display: none; text-align: center; margin-top: 15px; width: 100%; animation: slideUp 0.2s ease;">
        ${meaningsHTML}
        <div class="word-sentence-meaning">${sentenceMeaningText}</div>
        ${familyHTML}
        <div class="swipe-note-container" style="width: 100%;"></div>
      </div>
      
      <div class="flip-tip">🔄 Chạm để lật và xem nghĩa</div>
    `;
    
    cardEl.querySelector('.audio-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const isFlipped = cardEl.querySelector('.card-inner-meaning').style.display !== 'none';
      if (isFlipped) {
        speakTranslationSequence(word);
      } else {
        speakText(wordText, 'de-DE');
      }
    });
    
    if (isTop) {
      setupSwipeGestures(cardEl, word.id);
    } else {
      cardEl.style.transform = 'scale(0.96) translateY(12px)';
      cardEl.style.opacity = '0.85';
    }
    
    container.appendChild(cardEl);

    // Render the dynamic editable notes section for the top card
    const swipeNoteCont = cardEl.querySelector('.swipe-note-container');
    renderNotesSection(word, swipeNoteCont, () => {
      renderSwipeCardStack();
    });
  });
}

function setupSwipeGestures(cardEl, wordId) {
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;
  let isDragging = false;
  
  const indicatorRight = cardEl.querySelector('.swipe-indicator.right');
  const indicatorLeft = cardEl.querySelector('.swipe-indicator.left');
  const indicatorUp = cardEl.querySelector('.swipe-indicator.up');
  
  const onDragStart = (x, y) => {
    startX = x;
    startY = y;
    isDragging = true;
    cardEl.classList.add('dragging');
  };
  
  const onDragMove = (x, y) => {
    if (!isDragging) return;
    
    currentX = x - startX;
    currentY = y - startY;
    
    const rotate = currentX / 15;
    cardEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(${rotate}deg)`;
    
    const threshold = 80;
    if (currentX > 30 && Math.abs(currentX) > Math.abs(currentY)) {
      const opacity = Math.min(Math.abs(currentX) / threshold, 1);
      indicatorRight.style.opacity = opacity;
      indicatorLeft.style.opacity = 0;
      indicatorUp.style.opacity = 0;
      cardEl.style.boxShadow = `0 16px 40px rgba(76, 175, 80, ${opacity * 0.35})`;
    } else if (currentX < -30 && Math.abs(currentX) > Math.abs(currentY)) {
      const opacity = Math.min(Math.abs(currentX) / threshold, 1);
      indicatorLeft.style.opacity = opacity;
      indicatorRight.style.opacity = 0;
      indicatorUp.style.opacity = 0;
      cardEl.style.boxShadow = `0 16px 40px rgba(244, 67, 54, ${opacity * 0.35})`;
    } else if (currentY < -30 && Math.abs(currentY) > Math.abs(currentX)) {
      const opacity = Math.min(Math.abs(currentY) / threshold, 1);
      indicatorUp.style.opacity = opacity;
      indicatorRight.style.opacity = 0;
      indicatorLeft.style.opacity = 0;
      cardEl.style.boxShadow = `0 16px 40px rgba(255, 152, 0, ${opacity * 0.35})`;
    } else {
      indicatorRight.style.opacity = 0;
      indicatorLeft.style.opacity = 0;
      indicatorUp.style.opacity = 0;
      cardEl.style.boxShadow = '';
    }
  };
  
  const onDragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    cardEl.classList.remove('dragging');
    
    // Check if it is a single tap (very small displacement)
    const displacement = Math.sqrt(currentX * currentX + currentY * currentY);
    if (displacement < 8) {
      const frontElements = cardEl.querySelectorAll('.word-display, .word-ipa, .word-sentence');
      const backElements = cardEl.querySelector('.card-inner-meaning');
      const tipEl = cardEl.querySelector('.flip-tip');
      
      const word = state.activeSwipe.cards[state.activeSwipe.currentIndex];
      if (word) {
        const wordText = word.word || word.id || '';
        const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
        
        if (backElements.style.display === 'none') {
          frontElements.forEach(el => el.style.display = 'none');
          backElements.style.display = 'block';
          speakTranslationSequence(word);
          tipEl.textContent = '🔄 Tap to show German card';
        } else {
          frontElements.forEach(el => el.style.display = '');
          backElements.style.display = 'none';
          speakText(wordText, 'de-DE');
          tipEl.textContent = '🔄 Tap to flip and show translation';
        }
      }
      currentX = 0;
      currentY = 0;
      return;
    }
    
    const threshold = 120;
    let swipeAction = null;
    
    if (currentX > threshold && Math.abs(currentX) > Math.abs(currentY)) {
      swipeAction = 'right';
    } else if (currentX < -threshold && Math.abs(currentX) > Math.abs(currentY)) {
      swipeAction = 'left';
    } else if (currentY < -threshold && Math.abs(currentY) > Math.abs(currentX)) {
      swipeAction = 'up';
    }
    
    if (swipeAction) {
      let endX = 0, endY = 0;
      let newStatus = 'new';
      
      if (swipeAction === 'right') {
        endX = window.innerWidth + 100;
        newStatus = 'remembered';
      } else if (swipeAction === 'left') {
        endX = -window.innerWidth - 100;
        newStatus = 'not_memorized';
      } else if (swipeAction === 'up') {
        endY = -window.innerHeight - 100;
        newStatus = 'learning';
      }
      
      cardEl.style.transform = `translate3d(${endX}px, ${endY}px, 0) rotate(${endX / 10}deg)`;
      cardEl.style.opacity = '0';
      
      ReviewService.handleSwipe(wordId, swipeAction === 'right' ? 'remembered' : 'learning');
      
      setTimeout(() => {
        state.activeSwipe.currentIndex++;
        renderSwipeCardStack();
      }, 300);
    } else {
      cardEl.style.transform = '';
      cardEl.style.boxShadow = '';
      indicatorRight.style.opacity = 0;
      indicatorLeft.style.opacity = 0;
      indicatorUp.style.opacity = 0;
    }
    
    currentX = 0;
    currentY = 0;
  };
  
  // Touch
  cardEl.addEventListener('touchstart', (e) => {
    if (
      e.target.closest('textarea') || 
      e.target.closest('button') || 
      e.target.closest('.audio-btn') || 
      e.target.closest('li')
    ) {
      return;
    }
    const t = e.touches[0];
    onDragStart(t.clientX, t.clientY);
  });
  cardEl.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onDragMove(t.clientX, t.clientY);
  });
  cardEl.addEventListener('touchend', () => {
    onDragEnd();
  });
  
  // Mouse
  cardEl.addEventListener('mousedown', (e) => {
    if (
      e.target.closest('textarea') || 
      e.target.closest('button') || 
      e.target.closest('.audio-btn') || 
      e.target.closest('li')
    ) {
      return;
    }
    onDragStart(e.clientX, e.clientY);
    const mouseMoveHandler = (moveEvent) => {
      onDragMove(moveEvent.clientX, moveEvent.clientY);
    };
    const mouseUpHandler = () => {
      onDragEnd();
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  });
}

// -------------------------------------------------------------
// GAME 1: WORD MATCHING (NỐI TỪ)
// -------------------------------------------------------------
function startMatchingGame() {
  state.matchGame.xp = 0;
  state.matchGame.matchedCount = 0;
  state.matchGame.selectedDe = null;
  state.matchGame.selectedVi = null;
  
  // Use sliced page list
  state.vocabList = getActiveStudyWords();
  
  // Create shuffled pool of words to match
  state.matchGame.pool = [...state.vocabList].sort(() => Math.random() - 0.5);
  state.matchGame.totalWords = state.matchGame.pool.length;
  
  const container = document.getElementById('matching-board-container');
  if (container) container.className = 'matching-game';
  
  showPage('matching-game-page');
  loadMatchNextRound();
}

function loadMatchNextRound() {
  state.matchGame.selectedDe = null;
  state.matchGame.selectedVi = null;
  state.matchGame.roundMatchedCount = 0;
  
  // Slice next 5 words from pool
  const roundWords = state.matchGame.pool.slice(0, 5);
  state.matchGame.pool = state.matchGame.pool.slice(5);
  
  state.matchGame.roundWordsCount = roundWords.length;
  
  // Map items and shuffle them
  state.matchGame.deItems = roundWords.map(w => ({ id: w.id, text: w.word || w.id })).sort(() => Math.random() - 0.5);
  state.matchGame.viItems = roundWords.map(w => ({ id: w.id, text: w.meaning_en || w.meaning || w.meaning_vn || '' })).sort(() => Math.random() - 0.5);
  
  renderMatchingBoard();
}

function renderMatchingBoard() {
  const container = document.getElementById('matching-board-container');
  container.innerHTML = '';
  
  const deCol = document.createElement('div');
  deCol.className = 'match-column';
  
  const viCol = document.createElement('div');
  viCol.className = 'match-column';
  
  state.matchGame.deItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'match-item';
    el.setAttribute('data-id', item.id);
    el.textContent = item.text;
    el.addEventListener('click', () => {
      if (el.classList.contains('correct')) return;
      // Pronounce the word in German when clicked!
      speakText(item.text, 'de-DE');
      selectMatchingItem('de', item.id, el);
    });
    deCol.appendChild(el);
  });
  
  state.matchGame.viItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'match-item';
    el.setAttribute('data-id', item.id);
    el.textContent = item.text;
    el.addEventListener('click', () => {
      if (el.classList.contains('correct')) return;
      selectMatchingItem('vi', item.id, el);
    });
    viCol.appendChild(el);
  });
  
  container.appendChild(deCol);
  container.appendChild(viCol);
  
  document.getElementById('match-xp-display').textContent = `${state.matchGame.xp} XP`;
  document.getElementById('match-progress-text').textContent = `${state.matchGame.matchedCount} / ${state.matchGame.totalWords} matched`;
}

function selectMatchingItem(type, id, element) {
  document.querySelectorAll('.match-item.incorrect').forEach(item => {
    item.classList.remove('incorrect');
  });

  if (type === 'de') {
    document.querySelectorAll('.match-column:first-child .match-item').forEach(item => item.classList.remove('selected'));
    if (state.matchGame.selectedDe === id) {
      state.matchGame.selectedDe = null;
    } else {
      state.matchGame.selectedDe = id;
      element.classList.add('selected');
    }
  } else {
    document.querySelectorAll('.match-column:last-child .match-item').forEach(item => item.classList.remove('selected'));
    if (state.matchGame.selectedVi === id) {
      state.matchGame.selectedVi = null;
    } else {
      state.matchGame.selectedVi = id;
      element.classList.add('selected');
    }
  }
  
  if (state.matchGame.selectedDe !== null && state.matchGame.selectedVi !== null) {
    const deId = state.matchGame.selectedDe;
    const viId = state.matchGame.selectedVi;
    
    const deEl = document.querySelector(`.match-column:first-child .match-item[data-id="${deId}"]`);
    const viEl = document.querySelector(`.match-column:last-child .match-item[data-id="${viId}"]`);
    
    if (deId === viId) {
      deEl.className = 'match-item correct';
      viEl.className = 'match-item correct';
      state.matchGame.matchedCount++;
      state.matchGame.roundMatchedCount++;
      state.matchGame.xp += 10;
      
      // Promote correct word status up the ladder (Unlearned -> Learning -> Remembered)
      const wordObj = state.allVocab.find(item => item.id === deId);
      if (wordObj) {
        if (wordObj.status === 'new' || wordObj.status === 'not_memorized' || !wordObj.status) {
          updateWordStatus(deId, 'learning');
        } else if (wordObj.status === 'learning') {
          updateWordStatus(deId, 'remembered');
        }
      }
      
      // Delay speak a bit to not clash with button tap pronunciation
      setTimeout(() => {
        speakText(deEl.textContent, 'de-DE');
      }, 300);
      
      document.getElementById('match-xp-display').textContent = `${state.matchGame.xp} XP`;
      document.getElementById('match-progress-text').textContent = `${state.matchGame.matchedCount} / ${state.matchGame.totalWords} matched`;
      
      if (state.matchGame.roundMatchedCount >= state.matchGame.roundWordsCount) {
        if (state.matchGame.pool.length > 0) {
          // Round complete, load next round
          setTimeout(() => {
            loadMatchNextRound();
          }, 1000);
        } else {
          setTimeout(showMatchWinScreen, 1000);
        }
      }
    } else {
      deEl.classList.add('incorrect');
      viEl.classList.add('incorrect');
      deEl.classList.remove('selected');
      viEl.classList.remove('selected');
      
      // Demote both mismatched words to learning status
      updateWordStatus(deId, 'learning');
      updateWordStatus(viId, 'learning');
    }
    
    state.matchGame.selectedDe = null;
    state.matchGame.selectedVi = null;
  }
}

function showMatchWinScreen() {
  const container = document.getElementById('matching-board-container');
  if (container) container.className = '';
  
  container.innerHTML = `
    <div class="game-result-container">
      <div class="result-icon">🏆</div>
      <div class="result-title">Match Completed!</div>
      <div class="result-score">+${state.matchGame.xp} XP</div>
      <div class="result-stats-row" style="justify-content: center; width: 100%;">
        <div class="result-stat-item">
          <div class="result-stat-val">${state.matchGame.matchedCount}/${state.matchGame.totalWords}</div>
          <div class="result-stat-lbl">Pairs matched</div>
        </div>
      </div>
      <button class="btn-primary" onclick="startMatchingGame()" style="margin-bottom: 12px;">Play Again</button>
      <button class="btn-primary" onclick="goBackFromStudy()" style="background:#CCC; color:#333;">Back</button>
    </div>
  `;
}

// -------------------------------------------------------------
// GAME 2: LISTENING PRACTICE
// -------------------------------------------------------------
function startListeningGame() {
  state.listeningGame.correctCount = 0;
  state.listeningGame.currentQuestionIndex = 0;
  
  // Restore original HTML elements before loading
  document.getElementById('listening-game-container').innerHTML = `
    <div class="listening-question-box">
      <button class="audio-btn" id="btn-listening-replay" style="font-size: 26px;">🔊</button>
      <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Tap to play audio again</span>
    </div>
    
    <div class="options-list" id="listening-options-list">
      <!-- 4 options buttons -->
    </div>
    
    <div class="listening-reveal-box" id="listening-reveal-box">
      <div id="listening-word-reveal" style="font-size:18px; font-weight:700; color:var(--text-primary);"></div>
      <div id="listening-sentence-reveal" style="font-size:14px; color:var(--text-secondary); font-style:italic;"></div>
      <button class="btn-next-question" id="btn-listening-next">Next →</button>
    </div>
  `;
  
  // Use sliced page list
  state.vocabList = getActiveStudyWords();
  state.listeningGame.totalQuestions = state.vocabList.length;
  state.listeningGame.questions = [...state.vocabList].sort(() => Math.random() - 0.5);
  
  showPage('listening-game-page');
  loadListeningQuestion();
}

function loadListeningQuestion() {
  const index = state.listeningGame.currentQuestionIndex;
  const word = state.listeningGame.questions[index];
  state.listeningGame.currentWord = word;
  state.listeningGame.hasAnswered = false;
  
  document.getElementById('listening-reveal-box').style.display = 'none';
  
  const total = state.listeningGame.totalQuestions;
  document.getElementById('listening-progress-text').textContent = `${index + 1} / ${total} questions`;
  document.getElementById('listening-progress-fill').style.width = `${((index + 1) / total) * 100}%`;
  
  const wordText = word.word || word.id || '';
  const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
  
  const options = [meaningText];
  const decoys = state.vocabList.filter(item => item.id !== word.id).map(item => item.meaning_en || item.meaning || item.meaning_vn || '');
  const shuffledDecoys = decoys.sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(3, shuffledDecoys.length); i++) {
    options.push(shuffledDecoys[i]);
  }
  
  while (options.length < 4) {
    options.push("Decoy Option " + options.length);
  }
  
  state.listeningGame.options = options.sort(() => Math.random() - 0.5);
  
  const listEl = document.getElementById('listening-options-list');
  listEl.innerHTML = '';
  
  const alphabets = ['A', 'B', 'C', 'D'];
  state.listeningGame.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `
      <div class="option-badge">${alphabets[idx]}</div>
      <span>${opt}</span>
    `;
    btn.addEventListener('click', () => {
      selectListeningAnswer(opt, btn);
    });
    listEl.appendChild(btn);
  });
  
  speakText(wordText, 'de-DE');
  
  const repeatBtn = document.getElementById('btn-listening-replay');
  const newRepeatBtn = repeatBtn.cloneNode(true);
  repeatBtn.parentNode.replaceChild(newRepeatBtn, repeatBtn);
  newRepeatBtn.addEventListener('click', () => {
    speakText(wordText, 'de-DE');
  });
}

function selectListeningAnswer(selectedMeaning, element) {
  if (state.listeningGame.hasAnswered) return;
  state.listeningGame.hasAnswered = true;
  
  const word = state.listeningGame.currentWord;
  const wordText = word.word || word.id || '';
  const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
  const isCorrect = selectedMeaning === meaningText;
  
  if (isCorrect) {
    element.className = 'option-btn correct';
    state.listeningGame.correctCount++;
  } else {
    element.className = 'option-btn incorrect';
    // Demote incorrect German word to learning status
    updateWordStatus(word.id, 'learning');
    
    document.querySelectorAll('#listening-options-list .option-btn').forEach(btn => {
      const text = btn.querySelector('span').textContent;
      if (text === meaningText) {
        btn.className = 'option-btn correct';
      }
    });
  }
  
  const revealBox = document.getElementById('listening-reveal-box');
  revealBox.style.display = 'flex';
  document.getElementById('listening-word-reveal').innerHTML = `${wordText} <span style="font-size:14px; font-weight:normal; color:#666;">${word.ipa || ''}</span>`;
  document.getElementById('listening-sentence-reveal').textContent = word.sentence || '';
  
  const nextBtn = document.getElementById('btn-listening-next');
  const newNextBtn = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
  
  newNextBtn.addEventListener('click', () => {
    state.listeningGame.currentQuestionIndex++;
    if (state.listeningGame.currentQuestionIndex < state.listeningGame.totalQuestions) {
      loadListeningQuestion();
    } else {
      showListeningResults();
    }
  });
}

function showListeningResults() {
  const container = document.getElementById('listening-game-container');
  const score = Math.round((state.listeningGame.correctCount / state.listeningGame.totalQuestions) * 100);
  
  container.innerHTML = `
    <div class="game-result-container">
      <div class="result-icon">${score >= 80 ? '🥳' : (score >= 50 ? '👍' : '💪')}</div>
      <div class="result-title">Listening Finished!</div>
      <div class="result-score">${score}%</div>
      <div class="result-stats-row">
        <div class="result-stat-item">
          <div class="result-stat-val">${state.listeningGame.correctCount}/${state.listeningGame.totalQuestions}</div>
          <div class="result-stat-lbl">Correct answers</div>
        </div>
      </div>
      <button class="btn-primary" onclick="startListeningGame()" style="margin-bottom: 12px;">Practice Again</button>
      <button class="btn-primary" onclick="goBackFromStudy()" style="background:#CCC; color:#333;">Back</button>
    </div>
  `;
}

// -------------------------------------------------------------
// GAME 3: WORD SPRINT (ĐUA TỪ VỰNG 60 GIÂY)
// -------------------------------------------------------------
function startSprintGame() {
  state.sprintGame.score = 0;
  state.sprintGame.combo = 0;
  state.sprintGame.maxCombo = 0;
  state.sprintGame.timeLeft = 60;
  
  // Restore original HTML elements before loading
  document.getElementById('sprint-game-container').innerHTML = `
    <div class="listening-question-box" style="margin-bottom: 24px;">
      <div class="subtitle" style="text-transform:uppercase; font-size:11px; letter-spacing:1px;">German Word</div>
      <div id="sprint-word-de" style="font-size: 28px; font-weight: 800; color: var(--text-primary);">der Sohn</div>
    </div>
    
    <div class="options-list" id="sprint-options-grid">
      <!-- Sprint buttons -->
    </div>
  `;
  
  // Use sliced page list
  state.vocabList = getActiveStudyWords();
  
  showPage('sprint-game-page');
  
  document.getElementById('sprint-timer-fill').style.width = '100%';
  document.getElementById('sprint-time-text').textContent = '60s';
  document.getElementById('sprint-score-val').textContent = '0';
  document.getElementById('sprint-combo-val').textContent = 'Combo x1';
  
  if (state.sprintGame.timerInterval) clearInterval(state.sprintGame.timerInterval);
  
  state.sprintGame.timerInterval = setInterval(() => {
    state.sprintGame.timeLeft--;
    document.getElementById('sprint-time-text').textContent = `${state.sprintGame.timeLeft}s`;
    
    const percentage = (state.sprintGame.timeLeft / 60) * 100;
    document.getElementById('sprint-timer-fill').style.width = `${percentage}%`;
    
    if (state.sprintGame.timeLeft <= 0) {
      clearInterval(state.sprintGame.timerInterval);
      showSprintResults();
    }
  }, 1000);
  
  loadSprintQuestion();
}

function loadSprintQuestion() {
  const word = state.vocabList[Math.floor(Math.random() * state.vocabList.length)];
  state.sprintGame.currentWord = word;
  
  const wordText = word.word || word.id || '';
  const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
  
  document.getElementById('sprint-word-de').textContent = wordText;
  
  speakText(wordText, 'de-DE');
  
  const options = [meaningText];
  const decoys = state.vocabList.filter(item => item.id !== word.id).map(item => item.meaning_en || item.meaning || item.meaning_vn || '');
  const shuffledDecoys = decoys.sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(3, shuffledDecoys.length); i++) {
    options.push(shuffledDecoys[i]);
  }
  
  while (options.length < 4) {
    options.push("Random Option " + options.length);
  }
  
  state.sprintGame.options = options.sort(() => Math.random() - 0.5);
  
  const listEl = document.getElementById('sprint-options-grid');
  listEl.innerHTML = '';
  
  state.sprintGame.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.style.textAlign = 'center';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      selectSprintAnswer(opt, btn);
    });
    listEl.appendChild(btn);
  });
}

function selectSprintAnswer(selectedMeaning, element) {
  const word = state.sprintGame.currentWord;
  const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
  const isCorrect = selectedMeaning === meaningText;
  
  if (isCorrect) {
    element.className = 'option-btn correct';
    state.sprintGame.combo++;
    if (state.sprintGame.combo > state.sprintGame.maxCombo) {
      state.sprintGame.maxCombo = state.sprintGame.combo;
    }
    
    const multiplier = Math.min(4, Math.floor(state.sprintGame.combo / 3) + 1);
    state.sprintGame.score += 10 * multiplier;
    
    document.getElementById('sprint-score-val').textContent = state.sprintGame.score;
    document.getElementById('sprint-combo-val').textContent = `Combo x${multiplier} (${state.sprintGame.combo} streak)`;
    
    setTimeout(loadSprintQuestion, 250);
  } else {
    element.className = 'option-btn incorrect';
    state.sprintGame.combo = 0;
    document.getElementById('sprint-combo-val').textContent = 'Combo x1';
    
    // Demote incorrect German word to learning status
    updateWordStatus(word.id, 'learning');
    
    document.querySelectorAll('#sprint-options-grid .option-btn').forEach(btn => {
      if (btn.textContent === meaningText) {
        btn.className = 'option-btn correct';
      }
    });
    
    setTimeout(loadSprintQuestion, 600);
  }
}

function showSprintResults() {
  const container = document.getElementById('sprint-game-container');
  container.innerHTML = `
    <div class="game-result-container">
      <div class="result-icon">⚡</div>
      <div class="result-title">Word Sprint Finished!</div>
      <div class="result-score">${state.sprintGame.score} Points</div>
      <div class="result-stats-row">
        <div class="result-stat-item">
          <div class="result-stat-val">${state.sprintGame.maxCombo}</div>
          <div class="result-stat-lbl">Highest Streak</div>
        </div>
      </div>
      <button class="btn-primary" onclick="startSprintGame()" style="margin-bottom: 12px;">Sprint Again</button>
      <button class="btn-primary" onclick="goBackFromStudy()" style="background:#CCC; color:#333;">Back</button>
    </div>
  `;
}

// -------------------------------------------------------------
// SVG ICONS LOADER
// -------------------------------------------------------------
function initSVGIcons() {
  const icons = {
    book: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    grammar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
    lesson: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M6 18.8v-4L2 13v6a1 1 0 0 0 1 1h3Z"/><path d="M18 13.8v5.4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6Z"/></svg>`,
    test: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-award"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
  };
  
  document.querySelectorAll('[data-svg]').forEach(el => {
    const key = el.getAttribute('data-svg');
    if (icons[key]) {
      el.innerHTML = icons[key];
    }
  });
}

// MODAL MANAGEMENT HELPERS
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// EDITABLE REALTIME NOTES LOGIC
function saveWordNotes(wordId, notesArray) {
  const word = state.vocabList.find(item => item.id === wordId);
  let originalIsString = false;
  if (word && typeof word.note === 'string') {
    originalIsString = true;
  }
  
  // Convert to target save format
  const saveValue = originalIsString ? (notesArray[0] || '') : notesArray;
  
  if (word) {
    word.note = saveValue;
  }
  const masterWord = state.allVocab.find(item => item.id === wordId);
  if (masterWord) {
    masterWord.note = saveValue;
  }
  
  if (state.isFirebaseInitialized && state.db) {
    state.db.ref('vocab/' + wordId).update({ note: saveValue })
      .then(() => console.log(`Notes updated in Firebase for word ${wordId}`))
      .catch(err => console.error('Firebase update note error:', err));
  } else {
    localStorage.setItem('local_vocab', JSON.stringify(state.allVocab));
  }
}

function renderNotesSection(word, containerElement, onUpdateCallback) {
  if (!containerElement) return;
  containerElement.innerHTML = '';
  
  let notes = [];
  if (word.note) {
    if (Array.isArray(word.note)) {
      notes = word.note;
    } else if (typeof word.note === 'string') {
      notes = [word.note];
    }
  }
  
  if (notes.length === 0) {
    containerElement.style.display = 'none';
    return;
  }
  
  containerElement.style.display = 'block';
  
  const title = document.createElement('div');
  title.className = 'card-section-title';
  title.textContent = 'Notes & Tricks';
  containerElement.appendChild(title);
  
  const list = document.createElement('ul');
  list.className = 'card-list-items';
  
  notes.forEach((noteText, idx) => {
    const li = document.createElement('li');
    li.style.cursor = 'pointer';
    li.title = 'Double click to edit note';
    li.textContent = noteText;
    
    // Handle Double Click to edit inline
    li.addEventListener('dblclick', (e) => {
      e.stopPropagation(); // Stop parent flips
      
      const textarea = document.createElement('textarea');
      textarea.value = noteText;
      textarea.style.cssText = 'width: 100%; font-family: inherit; font-size: 12px; padding: 6px; border: 1px solid var(--primary); border-radius: 6px; outline: none; resize: vertical; margin-top: 4px;';
      
      li.textContent = '';
      li.appendChild(textarea);
      textarea.focus();
      
      let hasSaved = false;
      const saveEdit = () => {
        if (hasSaved) return;
        hasSaved = true;
        const updatedVal = textarea.value.trim();
        
        let currentNotes = [];
        if (Array.isArray(word.note)) {
          currentNotes = [...word.note];
        } else if (typeof word.note === 'string') {
          currentNotes = [word.note];
        }
        
        if (updatedVal === '') {
          // Remove note if cleared
          currentNotes.splice(idx, 1);
        } else {
          currentNotes[idx] = updatedVal;
        }
        
        saveWordNotes(word.id, currentNotes);
        onUpdateCallback();
      };
      
      textarea.addEventListener('blur', saveEdit);
      textarea.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' && !evt.shiftKey) {
          evt.preventDefault();
          saveEdit();
        } else if (evt.key === 'Escape') {
          hasSaved = true;
          li.textContent = noteText;
        }
      });
    });
    
    list.appendChild(li);
  });
  
  containerElement.appendChild(list);
}

// NAVIGATION HELPERS FOR DYNAMIC STUDY/GAME ROUTING
function updateBackButtonsTarget() {
  const source = state.studySourcePage || 'topic-dashboard-page';
  const pages = [
    'passive-study-page', 
    'active-study-page', 
    'matching-game-page', 
    'listening-game-page', 
    'sprint-game-page',
    'fill-blank-game-page',
    'mixed-game-page'
  ];
  pages.forEach(pageId => {
    const btn = document.querySelector(`#${pageId} .back-btn`);
    if (btn) {
      btn.setAttribute('data-back-to', source);
    }
  });
}

function restoreVocabList() {
  let updatedList = [];
  if (state.tempFilterType === 'topic') {
    updatedList = state.allVocab.filter(item => (item.topic || 'General') === state.tempQueryValue);
  } else if (state.tempFilterType === 'all') {
    updatedList = [...state.allVocab];
  } else if (state.tempFilterType === 'remembered') {
    updatedList = state.allVocab.filter(item => item.status === 'remembered');
  } else if (state.tempFilterType === 'learning') {
    updatedList = state.allVocab.filter(item => item.status === 'learning');
  } else if (state.tempFilterType === 'unlearned') {
    updatedList = state.allVocab.filter(item => item.status === 'not_memorized' || item.status === 'new' || !item.status);
  }
  
  updatedList.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  state.vocabList = [...updatedList];
}

function goBackFromStudy() {
  restoreVocabList();
  
  // Safety check pagination
  const totalPages = Math.ceil(state.vocabList.length / state.topicPagination.itemsPerPage);
  if (state.topicPagination.currentPage > totalPages && totalPages > 0) {
    state.topicPagination.currentPage = totalPages;
  }
  
  document.getElementById('topic-desc-dashboard').textContent = `${state.vocabList.length} words`;
  renderTopicWords();
  
  showPage('topic-dashboard-page');
}

function openSingleWordFlashcard(word, activeListContext) {
  state.vocabList = [...activeListContext];
  const wordIdx = state.vocabList.findIndex(item => item.id === word.id);
  
  if (wordIdx !== -1) {
    state.passive.currentIndex = wordIdx;
  } else {
    state.vocabList = [word];
    state.passive.currentIndex = 0;
  }
  
  state.passive.isPlaying = false; // Pause autoplay mode
  state.studySourcePage = 'topic-dashboard-page';
  updateBackButtonsTarget();
  
  showPage('passive-study-page');
  document.getElementById('passive-topic-title').textContent = state.currentTopic || 'Vocabulary';
  renderPassiveCard();
  
  const btnPlay = document.getElementById('btn-passive-play');
  if (btnPlay) {
    btnPlay.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  }
}

// -------------------------------------------------------------
// USER ACTIVITY, STREAK AND STUDY TIME TRACKING (SRS FEATURES)
// -------------------------------------------------------------
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initUserStats() {
  const todayStr = getTodayDateString();
  const lastActiveDate = localStorage.getItem('last_active_date');
  
  // Generate daily task and sync UI immediately
  DailyTaskService.generateTodayTask(state.allVocab);
  updateDailyTaskUI();
  
  let statsChanged = false;
  
  if (lastActiveDate && lastActiveDate !== todayStr) {
    // New day! Check missed days
    const lastDate = new Date(lastActiveDate);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      const missedDays = diffDays - 1;
      const dailyGoal = parseInt(localStorage.getItem('daily_goal')) || 5;
      const accumulated = parseInt(localStorage.getItem('accumulated_words')) || 0;
      
      localStorage.setItem('accumulated_words', accumulated + (missedDays * dailyGoal));
      localStorage.setItem('streak_missed_days', missedDays);
    } else {
      localStorage.setItem('streak_missed_days', 0);
    }
    
    // Reset daily counters
    localStorage.setItem('today_studied_ids', JSON.stringify([]));
    localStorage.setItem('today_study_seconds', 0);
    localStorage.setItem('last_active_date', todayStr);
    statsChanged = true;
  } else if (!lastActiveDate) {
    // Initial setup
    localStorage.setItem('last_active_date', todayStr);
    localStorage.setItem('accumulated_words', 0);
    localStorage.setItem('streak_missed_days', 0);
    localStorage.setItem('today_studied_ids', JSON.stringify([]));
    localStorage.setItem('today_study_seconds', 0);
    localStorage.setItem('daily_goal', 5);
    statsChanged = true;
  }
  
  if (statsChanged) {
    saveStatsToDB();
  }
  
  // 5-second tick interval for tracking study time
  setInterval(() => {
    const activePage = document.querySelector('.page.active');
    if (activePage && [
      'passive-study-page', 
      'active-study-page', 
      'matching-game-page', 
      'listening-game-page', 
      'sprint-game-page',
      'fill-blank-game-page',
      'mixed-game-page'
    ].includes(activePage.id)) {
      let todaySecs = parseInt(localStorage.getItem('today_study_seconds')) || 0;
      todaySecs += 5;
      localStorage.setItem('today_study_seconds', todaySecs);
      
      // Save stats to Firebase database on every tick interval to keep it in sync
      saveStatsToDB();
      updateUserStatsDashboard();
    }
  }, 5000);
  
  updateUserStatsDashboard();
}

function recordWordLearnedAction(wordId) {
  const todayStr = getTodayDateString();
  
  localStorage.setItem('last_active_date', todayStr);
  
  // Record unique studied word
  let todayStudiedIds = JSON.parse(localStorage.getItem('today_studied_ids')) || [];
  if (!todayStudiedIds.includes(wordId)) {
    todayStudiedIds.push(wordId);
    localStorage.setItem('today_studied_ids', JSON.stringify(todayStudiedIds));
    
    // Decrement accumulated words
    let accumulated = parseInt(localStorage.getItem('accumulated_words')) || 0;
    if (accumulated > 0) {
      accumulated = Math.max(0, accumulated - 1);
      localStorage.setItem('accumulated_words', accumulated);
    }
  }
  
  saveStatsToDB();
  updateUserStatsDashboard();
}

function calculateStreak() {
  const streak = StreakService.getStreakData();
  const todayStr = getTodayDateString();
  const lastDateStr = streak.last_completed_date;
  
  if (lastDateStr && lastDateStr !== todayStr) {
    const lastDate = new Date(lastDateStr);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      streak.current_streak = 0;
      StreakService.saveStreakData(streak);
    }
  }
  return streak.current_streak;
}

function formatStudyTime(seconds) {
  if (seconds < 60) {
    return { val: seconds, unit: 'seconds' };
  }
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return { val: mins, unit: 'minutes' };
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) {
    return { val: hrs, unit: 'hours' };
  }
  return { val: `${hrs}h ${remainingMins}`, unit: 'minutes' };
}

function updateUserStatsDashboard() {
  if (!state.allVocab) return;
  
  // 1. Learned count
  const learnedCount = state.allVocab.filter(item => item.status === 'learning' || item.status === 'remembered').length;
  const learnedEl = document.getElementById('dashboard-learned-count');
  if (learnedEl) learnedEl.textContent = learnedCount;
  
  // 2. Goal target
  const dailyGoal = parseInt(localStorage.getItem('daily_goal')) || 5;
  const accumulated = parseInt(localStorage.getItem('accumulated_words')) || 0;
  const todayStudiedIds = JSON.parse(localStorage.getItem('today_studied_ids')) || [];
  const targetWordsEl = document.getElementById('dashboard-target-words');
  if (targetWordsEl) {
    targetWordsEl.textContent = `${todayStudiedIds.length} / ${dailyGoal + accumulated}`;
  }
  
  // 3. Streak
  const streakCount = calculateStreak();
  const streakEl = document.getElementById('dashboard-streak-count');
  if (streakEl) streakEl.textContent = streakCount;
  
  // Missed days
  const missedDays = parseInt(localStorage.getItem('streak_missed_days')) || 0;
  const missedEl = document.getElementById('dashboard-streak-missed');
  if (missedEl) {
    if (missedDays > 0) {
      missedEl.textContent = `Bỏ quên: ${missedDays} ngày`;
      missedEl.style.display = 'block';
    } else {
      missedEl.style.display = 'none';
    }
  }
  
  // 4. Study time
  const seconds = parseInt(localStorage.getItem('today_study_seconds')) || 0;
  const timeFormatted = formatStudyTime(seconds);
  const timeEl = document.getElementById('dashboard-study-time');
  const unitEl = document.getElementById('dashboard-study-unit');
  if (timeEl && unitEl) {
    timeEl.textContent = timeFormatted.val;
    unitEl.textContent = timeFormatted.unit;
  }
}

function getActiveStudyWords() {
  const currentPage = state.topicPagination.currentPage || 1;
  const itemsPerPage = state.topicPagination.itemsPerPage || 20;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  return state.vocabList.slice(startIndex, endIndex);
}

// iOS Safari Audio Autoplay Unlocker
function unlockIOSAudio() {
  // Initialize and play silent sound on the global audio player
  if (!window.globalAudio) {
    window.globalAudio = new Audio();
  }
  window.globalAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
  window.globalAudio.play().catch(() => {});
  
  // Unlock Web Speech Synthesis
  if (window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }
  
  // Remove event listeners once unlocked
  document.removeEventListener('click', unlockIOSAudio);
  document.removeEventListener('touchstart', unlockIOSAudio);
  console.log('iOS Audio Channels Unlocked successfully');
}

document.addEventListener('click', unlockIOSAudio);
document.addEventListener('touchstart', unlockIOSAudio);

// -------------------------------------------------------------
// GAME 4: SENTENCE FILL-IN (ĐIỀN TỪ VÀO CÂU VÍ DỤ)
// -------------------------------------------------------------
function startFillBlankGame() {
  restoreVocabList();
  state.fillBlankGame.correctCount = 0;
  state.fillBlankGame.currentQuestionIndex = 0;
  
  // Use sliced page list
  state.vocabList = getActiveStudyWords();
  
  // Filter only words that have a valid example sentence
  const pool = state.vocabList.filter(item => item.sentence && item.sentence.trim() !== '');
  
  if (pool.length < 2) {
    alert('Need at least 2 words with example sentences in this deck to play!');
    goBackFromStudy();
    return;
  }
  
  state.fillBlankGame.totalQuestions = pool.length;
  state.fillBlankGame.questions = [...pool].sort(() => Math.random() - 0.5);
  
  // Re-render initial DOM layout in container before start, fixing play again element destruction
  document.getElementById('fillblank-game-container').innerHTML = `
    <div class="listening-question-box" style="margin-bottom: 16px; min-height: 120px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; border-radius: var(--border-radius-md); background: white; border: 1px solid var(--border-color); text-align: center; box-shadow: var(--shadow-sm);">
      <div id="fillblank-sentence-de" style="font-size: 17px; font-weight: 700; color: var(--text-primary); line-height: 1.5; margin-bottom: 10px;"></div>
      <div id="fillblank-sentence-vi" style="font-size: 13px; color: var(--text-secondary); font-style: italic;"></div>
    </div>
    
    <div style="display: flex; justify-content: center; margin-bottom: 20px;">
      <button class="status-toggle-btn" id="btn-fillblank-hint" style="background: #FEF3C7; color: #D97706; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; border: none; cursor: pointer; margin: 0 auto;">
        <span>💡</span> Gợi ý
      </button>
    </div>
    
    <div id="fillblank-hint-text" style="display: none; text-align: center; font-size: 13px; font-weight: 600; color: #D97706; margin-bottom: 16px; background: #FFFBEB; padding: 10px; border-radius: 8px; border: 1px dashed #FCD34D;"></div>
    
    <div class="options-list" id="fillblank-options-grid">
      <!-- 4 option buttons -->
    </div>
    
    <div class="listening-reveal-box" id="fillblank-reveal-box" style="display: none; margin-top: 20px;">
      <div id="fillblank-word-reveal" style="font-size:18px; font-weight:700; color:var(--text-primary);"></div>
      <button class="btn-next-question" id="btn-fillblank-next">Next →</button>
    </div>
  `;
  
  showPage('fill-blank-game-page');
  loadFillBlankQuestion();
}

function loadFillBlankQuestion() {
  state.fillBlankGame.hasAnswered = false;
  
  const index = state.fillBlankGame.currentQuestionIndex;
  const word = state.fillBlankGame.questions[index];
  state.fillBlankGame.currentWord = word;
  
  const wordText = word.word || word.id || '';
  const sentence = word.sentence || '';
  const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
  
  // Replace wordText case-insensitively with blanks
  const escapedWord = wordText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(escapedWord, 'gi');
  let blankSentence = sentence.replace(regex, '_______');
  
  // If no replacement occurred (e.g. spelling slightly different), force a replace
  if (blankSentence === sentence) {
    blankSentence = sentence + ' (_______)';
  }
  
  document.getElementById('fillblank-sentence-de').textContent = blankSentence;
  document.getElementById('fillblank-sentence-vi').textContent = word.sentence_meaning || word.sentence_vi || '';
  
  // Setup hint
  const hintBtn = document.getElementById('btn-fillblank-hint');
  const hintText = document.getElementById('fillblank-hint-text');
  hintText.style.display = 'none';
  hintText.textContent = `💡 Meaning of the word to fill: ${meaningText}`;
  
  const newHintBtn = hintBtn.cloneNode(true);
  hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
  newHintBtn.addEventListener('click', () => {
    hintText.style.display = hintText.style.display === 'none' ? 'block' : 'none';
  });
  
  // Setup options
  const options = [wordText];
  const decoys = state.allVocab.filter(item => item.word !== wordText).map(item => item.word);
  const shuffledDecoys = decoys.sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(3, shuffledDecoys.length); i++) {
    options.push(shuffledDecoys[i]);
  }
  
  while (options.length < 4) {
    options.push("Random Option " + options.length);
  }
  
  state.fillBlankGame.options = options.sort(() => Math.random() - 0.5);
  
  // Render options buttons
  const grid = document.getElementById('fillblank-options-grid');
  grid.innerHTML = '';
  
  state.fillBlankGame.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.style.textAlign = 'center';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      selectFillBlankAnswer(opt, btn);
    });
    grid.appendChild(btn);
  });
  
  // Hide reveal details
  document.getElementById('fillblank-reveal-box').style.display = 'none';
  
  // Update progress
  document.getElementById('fillblank-progress-text').textContent = `${index + 1} / ${state.fillBlankGame.totalQuestions} questions`;
  const progressPercent = ((index + 1) / state.fillBlankGame.totalQuestions) * 100;
  document.getElementById('fillblank-progress-fill').style.width = `${progressPercent}%`;
}
function selectFillBlankAnswer(selectedWord, btnElement) {
  if (state.fillBlankGame.hasAnswered) return;
  state.fillBlankGame.hasAnswered = true;
  
  const word = state.fillBlankGame.currentWord;
  const wordText = word.word || word.id || '';
  const isCorrect = selectedWord === wordText;
  
  if (isCorrect) {
    btnElement.className = 'option-btn correct';
    state.fillBlankGame.correctCount++;
    speakText(wordText, 'de-DE');
  } else {
    btnElement.className = 'option-btn incorrect';
    // Demote incorrect German word to learning status
    updateWordStatus(word.id, 'learning');
    
    // Highlight correct option
    document.querySelectorAll('#fillblank-options-grid .option-btn').forEach(btn => {
      if (btn.textContent === wordText) {
        btn.className = 'option-btn correct';
      }
    });
  }
  
  // Reveal correct sentence
  document.getElementById('fillblank-word-reveal').innerHTML = `Correct Word: <span style="color:var(--primary);">${wordText}</span> <span style="font-size:14px; font-weight:normal; color:#666;">${word.ipa || ''}</span>`;
  document.getElementById('fillblank-reveal-box').style.display = 'flex';
  
  // Next button click
  const nextBtn = document.getElementById('btn-fillblank-next');
  const newNextBtn = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
  
  newNextBtn.addEventListener('click', () => {
    state.fillBlankGame.currentQuestionIndex++;
    if (state.fillBlankGame.currentQuestionIndex < state.fillBlankGame.totalQuestions) {
      loadFillBlankQuestion();
    } else {
      showFillBlankResults();
    }
  });
}

function showFillBlankResults() {
  const container = document.getElementById('fillblank-game-container');
  const score = Math.round((state.fillBlankGame.correctCount / state.fillBlankGame.totalQuestions) * 100);
  
  container.innerHTML = `
    <div class="game-result-container">
      <div class="result-icon">${score >= 80 ? '🥳' : (score >= 50 ? '👍' : '💪')}</div>
      <div class="result-title">Practice Completed!</div>
      <div class="result-score">${score}%</div>
      <div class="result-stats-row" style="justify-content: center; width: 100%;">
        <div class="result-stat-item">
          <div class="result-stat-val">${state.fillBlankGame.correctCount}/${state.fillBlankGame.totalQuestions}</div>
          <div class="result-stat-lbl">Correct answers</div>
        </div>
      </div>
      <button class="btn-primary" onclick="startFillBlankGame()" style="margin-bottom: 12px;">Practice Again</button>
      <button class="btn-primary" onclick="goBackFromStudy()" style="background:#CCC; color:#333;">Back</button>
    </div>
  `;
}

// -------------------------------------------------------------
// GAME 5: MIXED CHALLENGE (THỬ THÁCH TỔNG HỢP RANDOM)
// -------------------------------------------------------------
function startMixedGame() {
  restoreVocabList();
  state.mixedGame.correctCount = 0;
  state.mixedGame.currentQuestionIndex = 0;
  
  // Use sliced page list
  state.vocabList = getActiveStudyWords();
  
  if (state.vocabList.length < 2) {
    alert('Need at least 2 words in this deck to play Mixed Challenge!');
    goBackFromStudy();
    return;
  }
  
  // Generate random mixed questions
  const questions = state.vocabList.map(word => {
    // Determine possible question types
    const types = ['translation', 'listening'];
    if (word.sentence && word.sentence.trim() !== '') {
      types.push('fillblank');
    }
    
    // Choose one type randomly
    const chosenType = types[Math.floor(Math.random() * types.length)];
    return {
      word: word,
      type: chosenType
    };
  });
  
  state.mixedGame.totalQuestions = questions.length;
  state.mixedGame.questions = questions.sort(() => Math.random() - 0.5);
  
  // Restore initial DOM in mixed container
  document.getElementById('mixed-game-container').innerHTML = `
    <!-- Dynamic Question Box -->
    <div class="listening-question-box" id="mixed-question-box" style="margin-bottom: 16px; min-height: 120px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; border-radius: var(--border-radius-md); background: white; border: 1px solid var(--border-color); text-align: center; box-shadow: var(--shadow-sm);">
    </div>
    
    <!-- Hint Area (only for fillblank) -->
    <div id="mixed-hint-wrapper" style="display: none; flex-direction: column; align-items: center; margin-bottom: 20px;">
      <button class="status-toggle-btn" id="btn-mixed-hint" style="background: #FEF3C7; color: #D97706; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; border: none; cursor: pointer;">
        <span>💡</span> Gợi ý
      </button>
      <div id="mixed-hint-text" style="display: none; text-align: center; font-size: 13px; font-weight: 600; color: #D97706; margin-top: 10px; background: #FFFBEB; padding: 10px; border-radius: 8px; border: 1px dashed #FCD34D; width: 100%;"></div>
    </div>
    
    <!-- Options -->
    <div class="options-list" id="mixed-options-grid">
      <!-- 4 option buttons -->
    </div>
    
    <!-- Reveal details -->
    <div class="listening-reveal-box" id="mixed-reveal-box" style="display: none; margin-top: 20px;">
      <div id="mixed-word-reveal" style="font-size:18px; font-weight:700; color:var(--text-primary);"></div>
      <button class="btn-next-question" id="btn-mixed-next">Next →</button>
    </div>
  `;
  
  showPage('mixed-game-page');
  loadMixedQuestion();
}

function loadMixedQuestion() {
  state.mixedGame.hasAnswered = false;
  
  const index = state.mixedGame.currentQuestionIndex;
  const q = state.mixedGame.questions[index];
  const word = q.word;
  state.mixedGame.currentWord = word;
  
  const wordText = word.word || word.id || '';
  const meaningText = word.meaning_en || word.meaning || word.meaning_vn || '';
  
  const typeLabel = document.getElementById('mixed-type-label');
  const questionBox = document.getElementById('mixed-question-box');
  const hintWrapper = document.getElementById('mixed-hint-wrapper');
  
  questionBox.innerHTML = '';
  hintWrapper.style.display = 'none';
  
  let options = [];
  let correctValue = '';
  
  if (q.type === 'translation') {
    typeLabel.textContent = 'Choose Meaning';
    typeLabel.style.color = '#3F51B5'; // Blue theme
    
    questionBox.innerHTML = `
      <div style="font-size: 26px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; justify-content: center; gap: 8px;">
        ${wordText}
        <button class="audio-btn" id="btn-mixed-replay" style="font-size: 16px; width: 28px; height: 28px;">🔊</button>
      </div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-top: 6px;">[${word.ipa || ''}]</div>
    `;
    
    // Auto speak
    speakText(wordText, 'de-DE');
    
    document.getElementById('btn-mixed-replay').addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(wordText, 'de-DE');
    });
    
    correctValue = meaningText;
    options = [meaningText];
    const decoys = state.allVocab.filter(item => item.word !== wordText).map(item => item.meaning_en || item.meaning || item.meaning_vn || '');
    const shuffledDecoys = decoys.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(3, shuffledDecoys.length); i++) {
      options.push(shuffledDecoys[i]);
    }
    
  } else if (q.type === 'listening') {
    typeLabel.textContent = 'Listen & Choose';
    typeLabel.style.color = '#E05A47'; // Primary red theme
    
    questionBox.innerHTML = `
      <button class="audio-btn" id="btn-mixed-replay" style="font-size: 28px; width: 54px; height: 54px; margin-bottom: 8px;">🔊</button>
      <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Tap to play audio again</span>
    `;
    
    // Auto speak
    speakText(wordText, 'de-DE');
    
    document.getElementById('btn-mixed-replay').addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(wordText, 'de-DE');
    });
    
    correctValue = meaningText;
    options = [meaningText];
    const decoys = state.allVocab.filter(item => item.word !== wordText).map(item => item.meaning_en || item.meaning || item.meaning_vn || '');
    const shuffledDecoys = decoys.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(3, shuffledDecoys.length); i++) {
      options.push(shuffledDecoys[i]);
    }
    
  } else if (q.type === 'fillblank') {
    typeLabel.textContent = 'Fill in the Blank';
    typeLabel.style.color = '#D97706'; // Orange theme
    
    const escapedWord = wordText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedWord, 'gi');
    let blankSentence = word.sentence.replace(regex, '_______');
    if (blankSentence === word.sentence) {
      blankSentence = word.sentence + ' (_______)';
    }
    
    questionBox.innerHTML = `
      <div style="font-size: 17px; font-weight: 700; color: var(--text-primary); line-height: 1.5; margin-bottom: 10px;">${blankSentence}</div>
      <div style="font-size: 13px; color: var(--text-secondary); font-style: italic;">${word.sentence_meaning || word.sentence_vi || ''}</div>
    `;
    
    hintWrapper.style.display = 'flex';
    const hintBtn = document.getElementById('btn-mixed-hint');
    const hintText = document.getElementById('mixed-hint-text');
    hintText.style.display = 'none';
    hintText.textContent = `💡 Meaning of the word to fill: ${meaningText}`;
    
    const newHintBtn = hintBtn.cloneNode(true);
    hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
    newHintBtn.addEventListener('click', () => {
      hintText.style.display = hintText.style.display === 'none' ? 'block' : 'none';
    });
    
    correctValue = wordText;
    options = [wordText];
    const decoys = state.allVocab.filter(item => item.word !== wordText).map(item => item.word);
    const shuffledDecoys = decoys.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(3, shuffledDecoys.length); i++) {
      options.push(shuffledDecoys[i]);
    }
  }
  
  // Format options
  while (options.length < 4) {
    options.push("Random Option " + options.length);
  }
  
  options.sort(() => Math.random() - 0.5);
  
  // Render options grid
  const grid = document.getElementById('mixed-options-grid');
  grid.innerHTML = '';
  
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.style.textAlign = 'center';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      selectMixedAnswer(opt, correctValue, btn);
    });
    grid.appendChild(btn);
  });
  
  // Hide reveal details
  document.getElementById('mixed-reveal-box').style.display = 'none';
  
  // Update progress
  document.getElementById('mixed-progress-text').textContent = `${index + 1} / ${state.mixedGame.totalQuestions} questions`;
  const progressPercent = ((index + 1) / state.mixedGame.totalQuestions) * 100;
  document.getElementById('mixed-progress-fill').style.width = `${progressPercent}%`;
}

function selectMixedAnswer(selectedVal, correctVal, btnElement) {
  if (state.mixedGame.hasAnswered) return;
  state.mixedGame.hasAnswered = true;
  
  const word = state.mixedGame.currentWord;
  const isCorrect = selectedVal === correctVal;
  
  if (isCorrect) {
    btnElement.className = 'option-btn correct';
    state.mixedGame.correctCount++;
    speakText(word.word, 'de-DE');
  } else {
    btnElement.className = 'option-btn incorrect';
    // Demote incorrect German word to learning status
    updateWordStatus(word.id, 'learning');
    
    // Highlight correct option
    document.querySelectorAll('#mixed-options-grid .option-btn').forEach(btn => {
      if (btn.textContent === correctVal) {
        btn.className = 'option-btn correct';
      }
    });
  }
  
  // Reveal details
  document.getElementById('mixed-word-reveal').innerHTML = `Correct Word: <span style="color:var(--primary); font-weight:700;">${word.word}</span> <span style="font-size:14px; font-weight:normal; color:#666;">${word.ipa || ''}</span><br><span style="font-size:13px; font-weight:normal; color:var(--text-secondary);">${word.meaning_en || word.meaning || word.meaning_vn || ''}</span>`;
  document.getElementById('mixed-reveal-box').style.display = 'flex';
  
  // Next button click
  const nextBtn = document.getElementById('btn-mixed-next');
  const newNextBtn = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
  
  newNextBtn.addEventListener('click', () => {
    state.mixedGame.currentQuestionIndex++;
    if (state.mixedGame.currentQuestionIndex < state.mixedGame.totalQuestions) {
      loadMixedQuestion();
    } else {
      showMixedResults();
    }
  });
}

function showMixedResults() {
  const container = document.getElementById('mixed-game-container');
  const score = Math.round((state.mixedGame.correctCount / state.mixedGame.totalQuestions) * 100);
  
  container.innerHTML = `
    <div class="game-result-container">
      <div class="result-icon">${score >= 80 ? '🥳' : (score >= 50 ? '👍' : '💪')}</div>
      <div class="result-title">Challenge Completed!</div>
      <div class="result-score">${score}%</div>
      <div class="result-stats-row" style="justify-content: center; width: 100%;">
        <div class="result-stat-item">
          <div class="result-stat-val">${state.mixedGame.correctCount}/${state.mixedGame.totalQuestions}</div>
          <div class="result-stat-lbl">Correct answers</div>
        </div>
      </div>
      <button class="btn-primary" onclick="startMixedGame()" style="margin-bottom: 12px;">Challenge Again</button>
      <button class="btn-primary" onclick="goBackFromStudy()" style="background:#CCC; color:#333;">Back</button>
    </div>
  `;
}

// -------------------------------------------------------------
// STREAK GARDEN (VƯỜN CÂY STREAK GAMIFICATION)
// -------------------------------------------------------------
function openStreakGardenModal() {
  const streak = calculateStreak();
  const missedDays = parseInt(localStorage.getItem('streak_missed_days')) || 0;
  
  // Update status labels
  document.getElementById('garden-status-active').textContent = `${streak} ${streak === 1 ? 'day' : 'days'} (${streak} healthy)`;
  document.getElementById('garden-status-dead').textContent = `${missedDays} ${missedDays === 1 ? 'day' : 'days'} (${missedDays} dead)`;
  
  // Motivational messages
  const motivationEl = document.getElementById('garden-motivation');
  if (streak === 0) {
    motivationEl.textContent = '🌱 Study today to plant your first tree!';
    motivationEl.style.color = '#B45309';
  } else if (missedDays > 0) {
    motivationEl.textContent = '⚠️ Keep studying daily to save your garden!';
    motivationEl.style.color = '#EF4444';
  } else {
    motivationEl.textContent = '🌳 Your garden is thriving! Keep it up!';
    motivationEl.style.color = '#059669';
  }
  
  // Render garden grid using milestone-based tree tiers (largest first)
  const bed = document.getElementById('garden-bed');
  bed.innerHTML = '';
  
  // Calculate tiers for active streak
  let tempStreak = streak;
  const peachTrees = Math.floor(tempStreak / 100);
  tempStreak %= 100;
  const cherryBlossoms = Math.floor(tempStreak / 50);
  tempStreak %= 50;
  const oakTrees = Math.floor(tempStreak / 10);
  tempStreak %= 10;
  const youngPlants = Math.floor(tempStreak / 5);
  tempStreak %= 5;
  const sprouts = tempStreak;
  
  // Calculate tiers for missed days
  let tempMissed = missedDays;
  const deadLogs = Math.floor(tempMissed / 10);
  const deadLeaves = tempMissed % 10;
  
  // Milestone pools for randomization
  const heartPool = ['❤️', '🧡', '💛', '💚', '💙', '💜', '💖', '💝', '🤍', '🤎'];
  const fruitPool = ['🍑', '🍓', '🍎', '🍏', '🍐', '🍊', '🍋', '🍒', '🍇', '🍉'];
  const flowerPool = ['🌸', '🌷', '🪷', '🌻', '🌹', '🌺', '🌼'];
  const treePool = ['🌳', '🌲', '🌴', '🎋'];
  
  // Build garden items list
  const gardenItems = [];
  
  // Add healthy trees with deterministic random index mapping based on count
  for (let i = 0; i < peachTrees; i++) {
    const emoji = heartPool[i % heartPool.length];
    gardenItems.push({ type: 'healthy', emoji: emoji, label: '100d' });
  }
  for (let i = 0; i < cherryBlossoms; i++) {
    const emoji = fruitPool[i % fruitPool.length];
    gardenItems.push({ type: 'healthy', emoji: emoji, label: '50d' });
  }
  for (let i = 0; i < oakTrees; i++) {
    const emoji = flowerPool[i % flowerPool.length];
    gardenItems.push({ type: 'healthy', emoji: emoji, label: '10d' });
  }
  for (let i = 0; i < youngPlants; i++) {
    const emoji = treePool[i % treePool.length];
    gardenItems.push({ type: 'healthy', emoji: emoji, label: '5d' });
  }
  for (let i = 0; i < sprouts; i++) {
    gardenItems.push({ type: 'healthy', emoji: '🌱', label: '1d' });
  }
  
  // Add dead trees
  for (let i = 0; i < deadLogs; i++) gardenItems.push({ type: 'dead', emoji: '🪵', label: '10m' });
  for (let i = 0; i < deadLeaves; i++) gardenItems.push({ type: 'dead', emoji: '🍂', label: '1m' });
  
  // Compute total slots (minimum 15 slots, grows dynamically in rows of 5)
  const totalSlots = Math.max(15, Math.ceil(gardenItems.length / 5) * 5);
  
  for (let i = 0; i < totalSlots; i++) {
    const slot = document.createElement('div');
    
    if (i < gardenItems.length) {
      const item = gardenItems[i];
      if (item.type === 'healthy') {
        slot.className = 'garden-slot';
        slot.style.flexDirection = 'column';
        slot.innerHTML = `
          <span class="garden-emoji" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.15)); line-height: 1.1;">${item.emoji}</span>
          <span style="font-size: 8px; font-weight: 800; color: #047857; margin-top: 1px; text-transform: uppercase;">${item.label}</span>
        `;
      } else {
        slot.className = 'garden-slot soil';
        slot.style.flexDirection = 'column';
        slot.innerHTML = `
          <span class="garden-emoji" style="filter: grayscale(0.8) opacity(0.7); display: inline-block; transform: rotate(15deg); line-height: 1.1;">${item.emoji}</span>
          <span style="font-size: 8px; font-weight: 800; color: #B91C1C; margin-top: 1px; text-transform: uppercase;">${item.label}</span>
        `;
      }
    } else {
      // Empty soil slot
      slot.className = 'garden-slot soil';
      slot.innerHTML = `<span style="font-size: 14px; opacity: 0.15;">🟫</span>`;
    }
    
    bed.appendChild(slot);
  }
  
  openModal('streak-garden-modal');
}

// -------------------------------------------------------------
// DATABASE SYNC FOR STREAK & STUDY STATS
// -------------------------------------------------------------
function saveStatsToDB() {
  const stats = {
    streak_dates: JSON.parse(localStorage.getItem('streak_dates')) || [],
    streak_missed_days: parseInt(localStorage.getItem('streak_missed_days')) || 0,
    today_study_seconds: parseInt(localStorage.getItem('today_study_seconds')) || 0,
    today_studied_ids: JSON.parse(localStorage.getItem('today_studied_ids')) || [],
    accumulated_words: parseInt(localStorage.getItem('accumulated_words')) || 0,
    last_active_date: localStorage.getItem('last_active_date') || ''
  };
  
  if (state.isFirebaseInitialized && state.db) {
    state.db.ref('user_stats').set(stats)
      .catch(err => console.error('Firebase save stats error:', err));
  }
}

function loadStatsFromDB(callback) {
  if (state.isFirebaseInitialized && state.db) {
    const todayStr = getTodayDateString();
    
    // Load user_stats
    state.db.ref('user_stats').once('value').then(snapshot => {
      const val = snapshot.val();
      if (val) {
        localStorage.setItem('streak_dates', JSON.stringify(val.streak_dates || []));
        localStorage.setItem('streak_missed_days', val.streak_missed_days || 0);
        localStorage.setItem('today_study_seconds', val.today_study_seconds || 0);
        localStorage.setItem('today_studied_ids', JSON.stringify(val.today_studied_ids || []));
        localStorage.setItem('accumulated_words', val.accumulated_words || 0);
        localStorage.setItem('last_active_date', val.last_active_date || '');
      }
      
      // Load user_streak
      return state.db.ref('user_streak').once('value');
    }).then(streakSnap => {
      const val = streakSnap.val();
      if (val) {
        localStorage.setItem('user_streak', JSON.stringify(val));
      }
      
      // Load today's daily task
      return state.db.ref(`daily_tasks/${todayStr}`).once('value');
    }).then(taskSnap => {
      const val = taskSnap.val();
      if (val) {
        localStorage.setItem(`daily_task_${todayStr}`, JSON.stringify(val));
      }
      
      // Generate task if missing
      DailyTaskService.generateTodayTask(state.allVocab);
      updateDailyTaskUI();
      updateUserStatsDashboard();
      
      if (callback) callback();
    }).catch(err => {
      console.error('Firebase load stats error:', err);
      // Still attempt local task generation
      DailyTaskService.generateTodayTask(state.allVocab);
      updateDailyTaskUI();
      if (callback) callback();
    });
  } else {
    // Generate task locally if offline
    DailyTaskService.generateTodayTask(state.allVocab);
    updateDailyTaskUI();
    if (callback) callback();
  }
}

// -------------------------------------------------------------
// CORE SERVICES: SRS, DAILY TASK, REVIEW, AND STREAK
// -------------------------------------------------------------

const SRSService = {
  intervals: {
    1: 1,
    2: 3,
    3: 7,
    4: 15,
    5: 30,
    6: 60,
    7: 120,
    8: 240,
    9: 365
  },
  
  getIntervalDays(repetitionCount) {
    if (repetitionCount <= 0) return 0;
    if (repetitionCount >= 9) return 365;
    return this.intervals[repetitionCount] || 1;
  },
  
  calculateNextReviewDate(todayStr, intervalDays) {
    if (!intervalDays || intervalDays <= 0) return null;
    const date = new Date(todayStr);
    date.setDate(date.getDate() + intervalDays);
    return formatDate(date);
  }
};

const DailyTaskService = {
  getTodayTask() {
    const todayStr = getTodayDateString();
    let task = null;
    
    // Check local storage first
    const cachedTaskStr = localStorage.getItem(`daily_task_${todayStr}`);
    if (cachedTaskStr) {
      task = JSON.parse(cachedTaskStr);
    }
    return task;
  },
  
  saveTask(task) {
    if (!task) return;
    const todayStr = task.date;
    localStorage.setItem(`daily_task_${todayStr}`, JSON.stringify(task));
    
    // Sync to Firebase if connected
    if (state.isFirebaseInitialized && state.db) {
      state.db.ref(`daily_tasks/${todayStr}`).set(task)
        .catch(err => console.error('Firebase save daily task error:', err));
    }
  },
  
  generateTodayTask(allVocab) {
    if (!allVocab || allVocab.length === 0) return null;
    
    const todayStr = getTodayDateString();
    let task = this.getTodayTask();
    if (task) return task; // Already exists
    
    // Group 1: Max 20 NEW words (sorted by ID to follow numeric sequence)
    const newWords = allVocab.filter(w => !w.status || w.status === 'unlearned' || w.status === 'new' || w.status === 'NEW')
                             .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
                             .slice(0, 20);
                             
    // Group 2: All LEARNING words
    const learningWords = allVocab.filter(w => w.status === 'learning' || w.status === 'LEARNING');
    
    // Group 3: All REMEMBER words due for review
    const reviewWords = allVocab.filter(w => {
      const isRemember = w.status === 'remembered' || w.status === 'remember' || w.status === 'REMEMBER';
      if (!isRemember) return false;
      if (!w.next_review_date || w.next_review_date === 0 || w.next_review_date === '0') return true; // Orphaned/0 remembered word -> review
      return w.next_review_date <= todayStr;
    });
    
    const wordIds = [
      ...newWords.map(w => w.id),
      ...learningWords.map(w => w.id),
      ...reviewWords.map(w => w.id)
    ];
    
    task = {
      id: todayStr,
      date: todayStr,
      word_ids: wordIds,
      completed_ids: [],
      total_cards: wordIds.length,
      completed_cards: 0,
      is_completed: false,
      completed_at: null
    };
    
    this.saveTask(task);
    return task;
  },
  
  completeCard(wordId) {
    const todayStr = getTodayDateString();
    let task = this.getTodayTask();
    if (!task) return;
    
    if (!task.completed_ids) {
      task.completed_ids = [];
    }
    
    if (task.word_ids.includes(wordId) && !task.completed_ids.includes(wordId)) {
      task.completed_ids.push(wordId);
      task.completed_cards = task.completed_ids.length;
      
      if (task.completed_cards === task.total_cards) {
        task.is_completed = true;
        task.completed_at = new Date().toISOString();
        
        // Trigger StreakService completion
        StreakService.completeDailyTask(todayStr);
      }
      
      this.saveTask(task);
      updateDailyTaskUI();
    }
  }
};

const ReviewService = {
  handleSwipe(wordId, swipeAction) {
    const todayStr = getTodayDateString();
    
    // Find the word in memory
    const word = state.allVocab.find(w => w.id === wordId);
    if (!word) return;
    
    const currentStatus = (word.status || 'unlearned').toLowerCase();
    
    if (swipeAction === 'remembered') {
      if (currentStatus === 'unlearned' || currentStatus === 'new') {
        word.status = 'learning';
      } else if (currentStatus === 'learning') {
        word.status = 'remembered';
        word.repetition_count = 1;
        word.interval_days = SRSService.getIntervalDays(1);
        word.last_reviewed_date = todayStr;
        word.next_review_date = SRSService.calculateNextReviewDate(todayStr, word.interval_days);
      } else if (currentStatus === 'remembered' || currentStatus === 'remember') {
        word.status = 'remembered';
        word.repetition_count = (word.repetition_count || 0) + 1;
        word.interval_days = SRSService.getIntervalDays(word.repetition_count);
        word.last_reviewed_date = todayStr;
        word.next_review_date = SRSService.calculateNextReviewDate(todayStr, word.interval_days);
      }
    } else {
      // swipeAction is 'unlearned' or 'learning'
      if (currentStatus === 'unlearned' || currentStatus === 'new') {
        word.status = 'learning';
      } else if (currentStatus === 'learning') {
        word.status = 'learning';
      } else if (currentStatus === 'remembered' || currentStatus === 'remember') {
        // Demote back to learning, reset spacing
        word.status = 'learning';
        word.repetition_count = 0;
        word.interval_days = 0;
        word.last_reviewed_date = 0;
        word.next_review_date = 0;
      }
    }
    
    word.updated_at = new Date().toISOString();
    
    // Save to Firebase/Local Vocab
    if (state.isFirebaseInitialized && state.db) {
      state.db.ref('vocab/' + wordId).update({
        status: word.status,
        repetition_count: word.repetition_count !== undefined ? word.repetition_count : 0,
        interval_days: word.interval_days !== undefined ? word.interval_days : 0,
        last_reviewed_date: word.last_reviewed_date || 0,
        next_review_date: word.next_review_date || 0,
        updated_at: word.updated_at
      })
      .then(() => {
        updateStatsFromList(state.allVocab);
      })
      .catch(err => console.error('Firebase vocab update error:', err));
    } else {
      localStorage.setItem('local_vocab', JSON.stringify(state.allVocab));
      updateStatsFromList(state.allVocab);
    }
    
    // Sync into vocabList if present
    const listWord = state.vocabList.find(w => w.id === wordId);
    if (listWord) {
      listWord.status = word.status;
      listWord.repetition_count = word.repetition_count;
      listWord.interval_days = word.interval_days;
      listWord.last_reviewed_date = word.last_reviewed_date;
      listWord.next_review_date = word.next_review_date;
    }
    
    // Log study action
    recordWordLearnedAction(wordId);
    
    // Update daily task progress
    DailyTaskService.completeCard(wordId);
  }
};

const StreakService = {
  getStreakData() {
    const defaultData = {
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: ''
    };
    const local = localStorage.getItem('user_streak');
    return local ? JSON.parse(local) : defaultData;
  },
  
  saveStreakData(data) {
    localStorage.setItem('user_streak', JSON.stringify(data));
    
    // Sync to user_streak in Firebase
    if (state.isFirebaseInitialized && state.db) {
      state.db.ref('user_streak').set(data)
        .catch(err => console.error('Firebase save user_streak error:', err));
    }
  },
  
  completeDailyTask(dateStr) {
    const streak = this.getStreakData();
    
    // Idempotency: if today was already completed, do nothing
    if (streak.last_completed_date === dateStr) return;
    
    const yesterdayStr = formatDate(new Date(new Date(dateStr) - 86400000));
    
    if (streak.last_completed_date === yesterdayStr) {
      streak.current_streak += 1;
    } else {
      streak.current_streak = 1;
    }
    
    streak.longest_streak = Math.max(streak.longest_streak, streak.current_streak);
    streak.last_completed_date = dateStr;
    
    this.saveStreakData(streak);
    
    // Sync streak_dates list so calendar/garden updates correctly
    let streakDates = JSON.parse(localStorage.getItem('streak_dates')) || [];
    if (!streakDates.includes(dateStr)) {
      streakDates.push(dateStr);
      localStorage.setItem('streak_dates', JSON.stringify(streakDates));
      saveStatsToDB();
    }
    
    updateUserStatsDashboard();
  }
};

function getTodayDateStringFormatted() {
  const d = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

function updateDailyTaskUI() {
  const todayStr = getTodayDateString();
  let task = DailyTaskService.getTodayTask();
  if (!task && state.allVocab.length > 0) {
    task = DailyTaskService.generateTodayTask(state.allVocab);
  }
  
  if (!task) return;
  
  document.getElementById('daily-task-date').textContent = getTodayDateStringFormatted();
  
  const total = task.total_cards;
  const completed = task.completed_cards;
  document.getElementById('daily-task-progress-text').textContent = `${completed} / ${total} cards`;
  
  const pct = total > 0 ? (completed / total) * 100 : 0;
  document.getElementById('daily-task-progress-bar').style.width = `${pct}%`;
  
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  
  task.word_ids.forEach(id => {
    const w = state.allVocab.find(item => item.id === id);
    if (w) {
      const status = (w.status || 'unlearned').toLowerCase();
      if (status === 'unlearned' || status === 'new') newCount++;
      else if (status === 'learning') learningCount++;
      else if (status === 'remembered' || status === 'remember') reviewCount++;
    }
  });
  
  document.getElementById('daily-task-new-count').textContent = newCount;
  document.getElementById('daily-task-learning-count').textContent = learningCount;
  document.getElementById('daily-task-review-count').textContent = reviewCount;
  
  const badge = document.getElementById('daily-task-status-badge');
  const startBtn = document.getElementById('btn-start-daily-task');
  
  if (task.is_completed) {
    badge.textContent = 'COMPLETED 🎉';
    badge.style.background = '#D1FAE5';
    badge.style.color = '#065F46';
    
    startBtn.textContent = '🎉 Daily Task Completed!';
    startBtn.style.background = '#10B981';
    startBtn.style.color = 'white';
    startBtn.style.cursor = 'default';
  } else {
    badge.textContent = 'In Progress';
    badge.style.background = '#FEF3C7';
    badge.style.color = '#92400E';
    
    startBtn.textContent = '🚀 Start Learning';
    startBtn.style.background = 'var(--primary)';
    startBtn.style.color = 'white';
    startBtn.style.cursor = 'pointer';
  }
}

function startDailyTaskSwipeStudy() {
  state.activeSwipe.currentIndex = 0;
  
  const dailyTask = DailyTaskService.getTodayTask();
  if (!dailyTask || dailyTask.word_ids.length === 0) {
    alert("Nhiệm vụ hôm nay trống!");
    return;
  }
  
  const activeList = state.allVocab.filter(word => dailyTask.word_ids.includes(word.id));
  state.vocabList = activeList;
  
  // Exclude already swiped cards for today to avoid duplicate work
  const completedIds = dailyTask.completed_ids || [];
  const uncompletedCards = activeList.filter(word => !completedIds.includes(word.id));
  
  if (uncompletedCards.length === 0) {
    // Already swiped all cards, let them review again
    state.activeSwipe.cards = activeList.sort(() => Math.random() - 0.5);
  } else {
    state.activeSwipe.cards = uncompletedCards.sort(() => Math.random() - 0.5);
  }
  
  state.activeSwipe.isDailyTaskMode = true;
  
  showPage('active-study-page');
  renderSwipeCardStack();
}

// -------------------------------------------------------------
// iOS PWA SPEECH & HTML5 AUDIO UNLOCKER
// -------------------------------------------------------------
// iOS PWA SPEECH UNLOCKER
// iOS requires a synchronous user gesture to unlock SpeechSynthesis.
// We hook into the very first touch/click to fire a silent utterance,
// which "unlocks" the audio context for all future calls.
// -------------------------------------------------------------
let _iosAudioUnlocked = false;

function unlockIOSAudio() {
  if (_iosAudioUnlocked) return;
  _iosAudioUnlocked = true;

  if ('speechSynthesis' in window) {
    // Speak a zero-length silent utterance to unlock the audio context
    const silent = new SpeechSynthesisUtterance('\u200B'); // zero-width space
    silent.volume = 0;
    silent.rate = 1;
    silent.lang = 'de-DE';
    window.speechSynthesis.speak(silent);

    // Also pre-cache voices right now while we have a user gesture
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) window._cachedVoices = voices;
  }

  document.removeEventListener('touchstart', unlockIOSAudio, true);
  document.removeEventListener('click', unlockIOSAudio, true);
}

// Use capture phase so we get the event before anything else
document.addEventListener('touchstart', unlockIOSAudio, { capture: true, passive: true });
document.addEventListener('click', unlockIOSAudio, { capture: true });
