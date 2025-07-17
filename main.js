document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const moneyElement = document.getElementById('money');
    const feedElement = document.getElementById('feed');
    const farmScreen = document.getElementById('farm-screen');
    const shopScreen = document.getElementById('shop-screen');
    const farmArea = document.getElementById('farm-area');

    // --- ボタン要素の取得 ---
    const toShopButton = document.getElementById('shop-button');
    const toFarmButton = document.getElementById('farm-button');
    const buyChickButton = document.getElementById('buy-chick');
    const buyFeedButton = document.getElementById('buy-feed');
    const resetButton = document.getElementById('reset-button');

    // --- ゲームの状態管理 ---
    let gameState = {
        money: 1000,
        feed: 0,
        animals: [], // {id, type, age, size, element} のようなオブジェクトを格納
        lastUpdate: Date.now(),
    };

    // --- 定数 ---
    const CHICK_PRICE = 100;
    const FEED_PRICE = 20;
    const CHICK_GROW_TIME = 300; // 5分 (秒)
    const CHICKEN_SHIP_TIME = 600; // 10分 (秒)
    const SHIP_PRICE = 250;
    const FEED_BOOST_DURATION = 60; // 1分 (秒)
    const FEED_BOOST_MULTIPLIER = 2;

    // ===================================================================
    // 画面切り替え
    // ===================================================================
    toShopButton.addEventListener('click', () => {
        farmScreen.style.display = 'none';
        shopScreen.style.display = 'block';
    });

    toFarmButton.addEventListener('click', () => {
        shopScreen.style.display = 'none';
        farmScreen.style.display = 'block';
    });

    // ===================================================================
    // ショップ機能
    // ===================================================================
    buyChickButton.addEventListener('click', () => {
        if (gameState.money >= CHICK_PRICE) {
            gameState.money -= CHICK_PRICE;
            addAnimal('chick');
            updateStatusUI();
            alert('ひよこを1羽購入しました！');
        } else {
            alert('お金が足りません！');
        }
    });

    buyFeedButton.addEventListener('click', () => {
        if (gameState.money >= FEED_PRICE) {
            gameState.money -= FEED_PRICE;
            gameState.feed++;
            updateStatusUI();
            alert('餌を1つ購入しました！');
        } else {
            alert('お金が足りません！');
        }
    });

    // ===================================================================
    // 動物の管理
    // ===================================================================
    function addAnimal(type) {
        const id = Date.now() + Math.random(); // ユニークID
        const animal = {
            id: id,
            type: type, // 'chick' or 'chicken'
            age: 0,     // 成長ゲージ (秒)
            size: 0,    // サイズゲージ (秒)
            isBoosted: false,
            boostEndTime: 0,
            element: createAnimalElement(id, type)
        };
        gameState.animals.push(animal);
        farmArea.appendChild(animal.element);
    }

    function createAnimalElement(id, type) {
        const el = document.createElement('div');
        el.classList.add('animal');
        el.dataset.id = id;
        el.textContent = type === 'chick' ? '🐥' : '🐔';

        // 牧場の枠線ギリギリに配置（親要素のpaddingを考慮）
        const farmRect = farmArea.getBoundingClientRect();
        const animalSize = 40; // 動物要素のおおよそのサイズ

        // farmAreaのpaddingを考慮しない、描画領域の実際の大きさを取得
        const availableWidth = farmArea.clientWidth - animalSize;
        const availableHeight = farmArea.clientHeight - animalSize;

        el.style.left = `${Math.random() * availableWidth}px`;
        el.style.top = `${Math.random() * availableHeight}px`;

        // ポップアップを作成（構造をここで確定）
        const popup = document.createElement('div');
        popup.classList.add('info-popup');
        popup.innerHTML = `
            <p>状態: <span class="animal-state">-</span></p>
            <progress class="growth-progress" value="0" max="100"></progress>
            <button class="feed-button" data-id="${id}">餌をあげる</button>
            <button class="ship-button" data-id="${id}" style="display:none;">出荷</button>
        `;
        el.appendChild(popup);

        return el;
    }

    // ===================================================================
    // UI更新
    // ===================================================================
    function updateStatusUI() {
        moneyElement.textContent = gameState.money;
        feedElement.textContent = gameState.feed;
    }

    function updateAnimalPopups() {
        gameState.animals.forEach(animal => {
            const popup = animal.element.querySelector('.info-popup');
            if (!popup) return;

            // ポップアップの中身のテキストやプログレスバーのみを更新
            const stateSpan = popup.querySelector('.animal-state');
            const progress = popup.querySelector('.growth-progress');
            const shipButton = popup.querySelector('.ship-button');

            if (animal.type === 'chick') {
                stateSpan.textContent = 'ひよこ';
                progress.value = (animal.age / CHICK_GROW_TIME) * 100;
                progress.style.display = 'block';
                shipButton.style.display = 'none';
            } else if (animal.type === 'chicken') {
                if (animal.size < CHICKEN_SHIP_TIME) {
                    stateSpan.textContent = 'ニワトリ';
                    progress.value = (animal.size / CHICKEN_SHIP_TIME) * 100;
                    progress.style.display = 'block';
                    shipButton.style.display = 'none';
                    animal.element.classList.remove('ready-to-ship');
                } else {
                    stateSpan.textContent = '出荷可能！';
                    progress.style.display = 'none';
                    shipButton.style.display = 'block';
                    animal.element.classList.add('ready-to-ship');
                }
            }

            // 餌やりブースト中のエフェクト
            if (animal.isBoosted) {
                animal.element.classList.add('feed-boost');
            } else {
                animal.element.classList.remove('feed-boost');
            }
        });
    }

    // ===================================================================
    // イベントリスナー（イベント委任） - ドラッグ＆クリック対応
    // ===================================================================
    let activeAnimalElement = null; // mousedownされた動物要素
    let isDragging = false;
    let dragStartX, dragStartY;
    // mousedownからmouseupまでのターゲットを一貫して扱うための変数
    let targetOnMouseDown = null;

    farmArea.addEventListener('mousedown', (e) => {
        // e.button === 0 は左クリックのみを対象とする
        if (e.button !== 0) return;

        targetOnMouseDown = e.target;
        activeAnimalElement = targetOnMouseDown.closest('.animal');

        // ドラッグ開始の準備
        e.preventDefault(); // デフォルトのドラッグやテキスト選択をキャンセル
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging && activeAnimalElement) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            // 一定距離を移動したらドラッグと判定
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging = true;
                // ドラッグが開始されたのが出荷可能なニワトリの場合のみ、スタイルを変更
                if (activeAnimalElement.classList.contains('ready-to-ship')) {
                    activeAnimalElement.style.zIndex = 1000;
                    activeAnimalElement.style.cursor = 'grabbing';
                    // ポップアップを隠す
                    const popup = activeAnimalElement.querySelector('.info-popup');
                    if (popup) popup.classList.remove('show');
                }
            }
        }

        // ドラッグ中の処理
        if (isDragging && activeAnimalElement && activeAnimalElement.classList.contains('ready-to-ship')) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            // transformで要素を移動
            activeAnimalElement.style.transform = `translate(${dx}px, ${dy}px)`;
        }
    }

    function onMouseUp(e) {
        if (isDragging && activeAnimalElement && activeAnimalElement.classList.contains('ready-to-ship')) {
            // --- ドラッグ終了時の処理（出荷） ---
            const id = activeAnimalElement.dataset.id;
            const animalIndex = gameState.animals.findIndex(a => a.id == id);

            if (animalIndex !== -1) {
                gameState.money += SHIP_PRICE;
                farmArea.removeChild(activeAnimalElement);
                gameState.animals.splice(animalIndex, 1);
                updateStatusUI();
                alert('ニワトリを出荷しました！');
            }
        } else {
            // --- クリック時の処理 ---
            const currentTarget = targetOnMouseDown; // mousedown時のターゲットで判定

            // 餌やりボタンが押された場合
            if (currentTarget.classList.contains('feed-button')) {
                const id = currentTarget.dataset.id;
                const animal = gameState.animals.find(a => a.id == id);
                if (animal && gameState.feed > 0 && !animal.isBoosted) {
                    gameState.feed--;
                    animal.isBoosted = true;
                    animal.boostEndTime = Date.now() + FEED_BOOST_DURATION * 1000;
                    updateStatusUI();
                    alert('餌をあげました！成長速度がアップ！');
                } else if (gameState.feed <= 0) {
                    alert('餌がありません！ショップで購入してください。');
                } else if (animal.isBoosted) {
                    alert('すでに速度アップ中です！');
                }
            }
            // 出荷ボタンが押された場合
            else if (currentTarget.classList.contains('ship-button')) {
                const id = currentTarget.dataset.id;
                const animalIndex = gameState.animals.findIndex(a => a.id == id);
                if (animalIndex !== -1) {
                    const animal = gameState.animals[animalIndex];
                    if (animal.type === 'chicken' && animal.size >= CHICKEN_SHIP_TIME) {
                        gameState.money += SHIP_PRICE;
                        farmArea.removeChild(animal.element);
                        gameState.animals.splice(animalIndex, 1);
                        updateStatusUI();
                        alert('ニワトリを出荷しました！');
                    }
                }
            }
            // 動物自体がクリックされた場合
            else if (activeAnimalElement) {
                const popup = activeAnimalElement.querySelector('.info-popup');
                if (popup) {
                    // 他のポップアップをすべて閉じる
                    document.querySelectorAll('.info-popup.show').forEach(p => {
                        if (p !== popup) p.classList.remove('show');
                    });
                    // このポップアップの表示/非表示を切り替え
                    popup.classList.toggle('show');
                }
            }
            // 背景（何もない場所）がクリックされた場合
            else if (!currentTarget.closest('.animal')) {
                document.querySelectorAll('.info-popup.show').forEach(p => {
                    p.classList.remove('show');
                });
            }
        }

        // --- クリーンアップ処理 ---
        if (activeAnimalElement) {
            // スタイルを元に戻す
            activeAnimalElement.style.zIndex = '';
            activeAnimalElement.style.cursor = '';
            activeAnimalElement.style.transform = '';
        }
        activeAnimalElement = null;
        isDragging = false;
        targetOnMouseDown = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    // ===================================================================
    // リセット機能
    // ===================================================================
    resetButton.addEventListener('click', () => {
        if (confirm('ゲームの進行状況がすべてリセットされます。よろしいですか？')) {
            // 自動セーブのタイマーを停止
            clearInterval(saveInterval);
            // リロードする直前に自動セーブが走るのを防ぐため、イベントリスナーを削除
            window.removeEventListener('beforeunload', saveGame);
            
            localStorage.removeItem('farmGameSave');
            location.reload();
        }
    });

    // ===================================================================
    // ゲームループ
    // ===================================================================
    function gameLoop() {
        const now = Date.now();
        const delta = (now - gameState.lastUpdate) / 1000; // 経過時間（秒）

        gameState.animals.forEach(animal => {
            let multiplier = 1;
            // ブーストチェック
            if (animal.isBoosted) {
                if (now < animal.boostEndTime) {
                    multiplier = FEED_BOOST_MULTIPLIER;
                } else {
                    animal.isBoosted = false; // ブースト終了
                }
            }

            // 成長処理
            if (animal.type === 'chick') {
                animal.age += delta * multiplier;
                if (animal.age >= CHICK_GROW_TIME) {
                    animal.type = 'chicken';
                    animal.element.textContent = '🐔'; // 見た目をニワトリに
                }
            } else if (animal.type === 'chicken') {
                if (animal.size < CHICKEN_SHIP_TIME) {
                    animal.size += delta * multiplier;
                }
            }
        });

        updateAnimalPopups();

        gameState.lastUpdate = now;
        requestAnimationFrame(gameLoop);
    }

    // ===================================================================
    // データ永続化 (セーブ/ロード)
    // ===================================================================
    function saveGame() {
        // elementは保存できないので除外して保存
        const stateToSave = {
            ...gameState,
            animals: gameState.animals.map(a => ({...a, element: null }))
        };
        localStorage.setItem('farmGameSave', JSON.stringify(stateToSave));
    }

    function loadGame() {
        const savedState = localStorage.getItem('farmGameSave');
        if (savedState) {
            const loaded = JSON.parse(savedState);
            // 読み込んだデータでgameStateを更新
            gameState.money = loaded.money;
            gameState.feed = loaded.feed;
            gameState.lastUpdate = loaded.lastUpdate || Date.now();

            // 動物のDOM要素を再生成
            gameState.animals = loaded.animals.map(animalData => {
                const animal = {
                    ...animalData,
                    element: createAnimalElement(animalData.id, animalData.type)
                };
                farmArea.appendChild(animal.element);
                return animal;
            });
        } else {
            // セーブデータがない場合は初期状態
            gameState.lastUpdate = Date.now();
        }
        updateStatusUI();
    }

    // 定期的にセーブ
    const saveInterval = setInterval(saveGame, 5000); // 5秒ごとに保存
    window.addEventListener('beforeunload', saveGame); // ページを離れるときに保存

    // ===================================================================
    // 初期化
    // ===================================================================
    loadGame();
    requestAnimationFrame(gameLoop);
});
