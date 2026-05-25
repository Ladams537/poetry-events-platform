<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { auth } from "$lib/auth";
  import { hostedEvents } from "$lib/client";

  const hostedQuery = createQuery(() => ({
    queryKey: ["hosted-events", $auth.accessToken],
    queryFn: () => hostedEvents($auth.accessToken),
    enabled: Boolean($auth.ready && $auth.accessToken)
  }));

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
</script>

<section class="page-head">
  <div>
    <p class="muted">Events you are hosting</p>
    <h1>Hosting dashboard.</h1>
  </div>
  <a class="button-link" href="/create">Create</a>
</section>

{#if !$auth.user}
  <article class="card">
    <h2>Log in to manage hosted events</h2>
    <a class="button-link" href="/login">Log in</a>
  </article>
{:else if hostedQuery.isLoading}
  <p>Loading hosted events...</p>
{:else if hostedQuery.isError}
  <p class="error">Could not load hosted events.</p>
{:else if hostedQuery.data?.events.length === 0}
  <article class="card">
    <h2>No hosted events yet</h2>
    <p class="muted">Create an event to see it here.</p>
  </article>
{:else}
  <section class="grid" aria-label="Hosted events">
    {#each hostedQuery.data?.events ?? [] as event}
      <article class="card">
        <a href={`/events/${event.id}`}>
          <h2>{event.title}</h2>
          <p>{event.description}</p>
          <div class="meta">
            <span>{formatter.format(new Date(event.startsAt))}</span>
            <span>{event.attendeeCount} attending</span>
            {#if event.cancelledAt}
              <span>Cancelled</span>
            {/if}
          </div>
        </a>
      </article>
    {/each}
  </section>
{/if}
