<script>
    let witchcraftDownloading = false
    let witchCraftInstalling = false
    let witchCraftInstalled = window.games.getDataForGame('witch_craft').installed || false

    window.api.receive("fromMain", (data) => {
        if(data.event === 'install'){
            if(data.step === 'start') console.log('preparing installation')
            if(data.step === 'download') console.log('downloading ' + data.progress + '%')
            if(data.step === 'installation-start') console.log('starting installation')
            if(data.step === 'installation') console.log('installing ' + data.progress + '%')
            if(data.step === 'complete') {
                witchCraftInstalled = true
                console.log('installation complete')
            }
        }

        if(data.event === 'update'){
            if(data.step === 'start') console.log('preparing launcher update')
            if(data.step === 'found') console.log('launcher update not found')
            if(data.step === 'not-found') console.log('launcher update found')
            if(data.step === 'download') console.log('downloading launcher update ' + data.progress + '%')
            if(data.step === 'complete') console.log('launcher update complete')
        }
    });

    function installWitchcraft(){
        window.games.install("witch_craft")
        witchcraftDownloading = true
    }

    function launchWitchcraft(){
        window.games.launch("witch_craft")
    }
</script>

<p>witchcraft - 43e essai</p>
{#if !witchCraftInstalled}
    <button on:click={installWitchcraft} >installer le jeu</button>
    {#if witchcraftDownloading}
        installation en cours
    {/if}
{:else}
    <button on:click={launchWitchcraft}>Lancer THE jeu</button>
{/if}