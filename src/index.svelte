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
    });

    function installWitchcraft(){
        window.games.install("witch_craft")
        witchcraftDownloading = true
    }

    function launchWitchcraft(){
        window.games.launch("witch_craft")
    }
</script>

<p>witchcraft - LE jeu</p>
{#if !witchCraftInstalled}
    <button on:click={installWitchcraft} >installer witchcraft</button>
    {#if witchcraftDownloading}
        installation en cours
    {/if}
{:else}
    <button on:click={launchWitchcraft}>Lancer le jeu</button>
{/if}