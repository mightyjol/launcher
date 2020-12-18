<header class="container text-gray-400 bg-nero-700">
    <div id="drag-region">
        <div id="window-title">
            <span>Flying Butter Studio</span>
        </div>
        <div id="window-controls">
            <div class="button" id="min-button" on:click={() => window.frame.minimize()}>
                <img class="icon" alt="minimize" srcset="icons/min-w-10.png 1x, icons/min-w-12.png 1.25x, icons/min-w-15.png 1.5x, icons/min-w-15.png 1.75x, icons/min-w-20.png 2x, icons/min-w-20.png 2.25x, icons/min-w-24.png 2.5x, icons/min-w-30.png 3x, icons/min-w-30.png 3.5x" draggable="false" />
            </div>

            <div class="button" id="max-button" on:click={() => window.frame.maximize()}>
                <img class="icon" alt="maximize" srcset="icons/max-w-10.png 1x, icons/max-w-12.png 1.25x, icons/max-w-15.png 1.5x, icons/max-w-15.png 1.75x, icons/max-w-20.png 2x, icons/max-w-20.png 2.25x, icons/max-w-24.png 2.5x, icons/max-w-30.png 3x, icons/max-w-30.png 3.5x" draggable="false" />
            </div>

            <div class="button" id="close-button" on:click={() => window.frame.close()}>
                <img class="icon" alt="close" srcset="icons/close-w-10.png 1x, icons/close-w-12.png 1.25x, icons/close-w-15.png 1.5x, icons/close-w-15.png 1.75x, icons/close-w-20.png 2x, icons/close-w-20.png 2.25x, icons/close-w-24.png 2.5x, icons/close-w-30.png 3x, icons/close-w-30.png 3.5x" draggable="false" />
            </div>
        </div>
    </div>
</header>

<style>
    header{
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
    }

    #drag-region {
        width: 100%;
        height: 100%;
        -webkit-app-region: drag;
    }
    
    #window-controls {
        display: grid;
        grid-template-columns: repeat(3, 46px);
        position: absolute;
        top: 0;
        right: 0;
        height: 100%;

        -webkit-app-region: no-drag;
    }

    #window-controls .button {
        grid-row: 1 / span 1;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        user-select: none;
    }

    #min-button {
        grid-column: 1;
    }
    #max-button, #restore-button {
        grid-column: 2;
    }
    #close-button {
        grid-column: 3;
    }

    #window-controls .button:hover {
        background: rgba(255,255,255,0.1);
    }
    #window-controls .button:active {
        background: rgba(255,255,255,0.2);
    }

    #close-button:hover {
        background: #E81123 !important;
    }
    #close-button:active {
        background: #F1707A !important;
    }
    #close-button:active .icon {
        filter: invert(1);
    }

    #restore-button {
        display: none !important;
    }

    #window-title {
        grid-column: 1;
        display: flex;
        align-items: center;
        margin-left: 8px;
        overflow: hidden;
        font-size: 12px;
    }

    #window-title span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 2.5;
    }
</style>