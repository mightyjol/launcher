<script>
    let witchcraftDownloading = false
    let witchCraftInstalling = false
    let witchCraftInstalled = window.games.getDataForGame('witch_craft').installed || false

    window.api.receive("fromMain", (data) => {
        console.log(`Received ${data} from main process`);
        if(data.event === 'install' && data.step === 'complete') witchCraftInstalled = true
    });

    function installWitchcraft(){
        window.games.install("witch_craft")
        witchcraftDownloading = true
    }

    function launchWitchcraft(){
        window.games.launch("witch_craft")
    }
</script>

<p>witchcraft - le jeu</p>
{#if !witchCraftInstalled}
    <button on:click={installWitchcraft} >installer witchcraft</button>
    {#if witchcraftDownloading}
        installation en cours
    {/if}
{:else}
    <button on:click={launchWitchcraft}>Lancer le jeu</button>
{/if}