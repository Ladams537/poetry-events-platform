<script lang="ts">
  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import { auth, loadStoredAuth, logout } from "$lib/auth";

  const queryClient = new QueryClient();

  onMount(() => {
    loadStoredAuth();
  });
</script>

<svelte:head>
  <title>Poetry Rooms</title>
  <meta
    name="description"
    content="Browse poetry events, RSVP, host readings, and discover recommendations."
  />
</svelte:head>

<QueryClientProvider client={queryClient}>
  <div class="app-shell">
    <header>
      <a class="brand" href="/">Poetry Rooms</a>
      <nav aria-label="Primary">
        <a href="/">Events</a>
        <a href="/recommendations">Recommendations</a>
        <a href="/dashboard">Hosting</a>
        <a href="/create">Create</a>
      </nav>
      <div class="account">
        {#if $auth.user}
          <span>{$auth.user.name}</span>
          <button type="button" on:click={() => logout($auth.accessToken)}>Log out</button>
        {:else}
          <a href="/login">Log in</a>
          <a class="button-link" href="/register">Sign up</a>
        {/if}
      </div>
    </header>

    <main>
      <slot />
    </main>
  </div>
</QueryClientProvider>

<style>
  :global(body) {
    margin: 0;
    background: #f7f5f0;
    color: #20201e;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  :global(a) {
    color: inherit;
  }

  :global(button),
  :global(input),
  :global(textarea) {
    font: inherit;
  }

  .app-shell {
    min-height: 100vh;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 24px;
    align-items: center;
    padding: 14px clamp(16px, 4vw, 48px);
    border-bottom: 1px solid #ded7ca;
    background: rgba(247, 245, 240, 0.94);
    backdrop-filter: blur(12px);
  }

  .brand {
    font-weight: 800;
    text-decoration: none;
    font-size: 1.15rem;
  }

  nav {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  nav a,
  .account a {
    text-decoration: none;
    color: #4d4a43;
    font-weight: 650;
  }

  .account {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: end;
  }

  button,
  .button-link {
    border: 1px solid #20201e;
    background: #20201e;
    color: #fff;
    padding: 9px 12px;
    border-radius: 8px;
    text-decoration: none;
    cursor: pointer;
  }

  main {
    padding: 32px clamp(16px, 4vw, 48px) 56px;
  }

  :global(.page-head) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: end;
    margin-bottom: 24px;
  }

  :global(h1) {
    margin: 0;
    font-size: clamp(2rem, 6vw, 4.5rem);
    line-height: 0.95;
    letter-spacing: 0;
  }

  :global(h2) {
    margin: 0 0 8px;
    font-size: 1.35rem;
  }

  :global(.muted) {
    color: #666054;
  }

  :global(.grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  :global(.card) {
    border: 1px solid #ded7ca;
    border-radius: 8px;
    background: #fffdf8;
    padding: 18px;
    box-shadow: 0 16px 40px rgba(32, 32, 30, 0.06);
  }

  :global(.card a) {
    text-decoration: none;
  }

  :global(.meta) {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    color: #666054;
    font-size: 0.92rem;
  }

  :global(.form) {
    max-width: 560px;
    display: grid;
    gap: 14px;
  }

  :global(label) {
    display: grid;
    gap: 6px;
    font-weight: 700;
  }

  :global(input),
  :global(textarea) {
    width: min(100%, 520px);
    box-sizing: border-box;
    border: 1px solid #cfc6b8;
    border-radius: 8px;
    background: #fffdf8;
    color: #20201e;
    padding: 11px 12px;
  }

  :global(textarea) {
    min-height: 140px;
    resize: vertical;
  }

  :global(.error) {
    color: #9f1d2d;
    font-weight: 700;
  }

  @media (max-width: 760px) {
    header {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .account {
      justify-content: start;
    }
  }
</style>
