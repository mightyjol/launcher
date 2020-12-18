<script>
    import Title from "./components/Title.svelte"
    let launcher = {
        updateFound: false,
        downloading: false
    }

    let games = {
        witch_craft: {
            checkingUpdate: false,
            wantsToLaunch: false,
            needsUpdate: undefined,
            installing: false,
            updating: false,
            cleanup: false,
            downloading: false,
            progress: 0,
            ...window.games.getDataForGame('witch_craft')
        }
    }

    console.log(window.games.getDataForGame('witch_craft'))
    if(games.witch_craft.installed){
        //window.games.needsUpdate('witch_craft')
    }

    function cancel(){
        window.games.cancel()
    }
 
    window.api.receive("fromMain", (data) => {
        if(data.event === 'install'){
            if(data.step === 'start') {
                console.log('preparing installation')

                console.log(games[data.game])
                if(games[data.game].installed) {
                    games[data.game].updating = true
                    console.log('game installed')
                }
                else {
                    games[data.game].installing = true
                    console.log('game not installed')
                }
                games[data.game].progress = 0
            }
            if(data.step === 'download') {
                console.log('downloading ' + data.progress + '%')
                games[data.game].progress = data.progress 
            }
            if(data.step === 'installation-start'){
                console.log('starting installation')
                if(games[data.game].installed) games[data.game].updating = false
                else games[data.game].installing = false
                games[data.game].cleanup = true 
            }
            if(data.step === 'installation') {
                console.log('installing ' + data.progress + '%')
            }
            if(data.step === 'complete') {
                console.log('installation complete')

                games[data.game].installed = true
                games[data.game].cleanup = false
                games[data.game].needsUpdate = false
                games[data.game].version = window.games.getDataForGame(data.game).version
                if(games[data.game].installed) games[data.game].updating = false
                else games[data.game].installing = false

                if(games[data.game].wantsToLaunch) window.games.launch(data.game)
            }
        }

        if(data.event === 'update-launcher'){
            if(data.step === 'start') { console.log('preparing launcher update') }
            if(data.step === 'found') {
                console.log('launcher update found')
                launcher.updateFound = true
            }
            if(data.step === 'not-found') console.log('launcher update not found')
            if(data.step === 'download') console.log('downloading launcher update ' + data.progress + '%')
            if(data.step === 'complete') { console.log('launcher update complete') }
            launcher = {...launcher}
        }

        if(data.event === 'update'){
            if(data.step === 'uptodate') {
                games[data.game].updating = false
                games[data.game].needsUpdate = false
                if(games[data.game].wantsToLaunch) window.games.launch(data.game)
            }
            if(data.step === 'start') {
                console.log('preparing update for: ' + data.game)
                games[data.game].updating = true
                games[data.game].progress = 0
            }
            if(data.step === 'download') {
                console.log('downloading update ' + data.progress + '% for: ' + data.game)
                games[data.game].progress = data.progress
            }
            if(data.step === 'installation-start') {
                games[data.game].cleanup = true
            }
            if(data.step === 'complete') { 
                console.log('update complete for: ' + data.game) 
                games[data.game].updating = false
                games[data.game].cleanup = false
                games[data.game].needsUpdate = false
                if(games[data.game].wantsToLaunch) window.games.launch(data.game)
            }
        }

        if(data.event === 'log') console.log(data.message)
        games = {...games}
    });

    function install(game){
        window.games.install(game)
        games[game].installing = true
        games = {...games}
    }

    function launch(game){
        games[game].wantsToLaunch = true
        games = {...games}
        if(games[game].needsUpdate === undefined){
            console.log('checking for update')
            games[game].updating = true 
            games = {...games}
            return window.games.needsUpdate(game, games[game].version)
        }
        else {
            window.games.launch('witch_craft')
        }
        
    }
</script>
<!-- 
{#if !games['witch_craft'].installed}
    {#if games['witch_craft'].installing}
        {#if games['witch_craft'].progress === 0}
            <p>preparing installation</p>
        {:else}
            <p>installation en cours</p>
            <p>{games['witch_craft'].progress}%</p>
        {/if}
    {:else if games['witch_craft'].cleanup}
        <p>cleaning up</p>
    {:else}
        <button on:click={() => install('witch_craft')} >installer le jeu</button>
    {/if}
{:else}
    {#if games['witch_craft'].updating}
        {#if games['witch_craft'].progress === 0}
            <p>checking for update</p>
        {:else}
            <p>mise à jour en cours</p>
            <p>{games['witch_craft'].progress}%</p>
        {/if}
    {:else if games['witch_craft'].cleanup}
        <p>cleaning up</p>
    {:else}
        <button on:click={() => launch('witch_craft')}>Lancer THE jeu</button>   
    {/if}
{/if}
 -->

<Title />
<main class="container w-screen flex justify-center items-center text-gray-300 bg-nero-600">
    <h1 class="text-center font-bold text-2xl uppercase">MAJ graphique</h1>
</main>

<style>
    main{
        margin-top: 32px;
        height: calc(100vh - 32px);
    }
</style>