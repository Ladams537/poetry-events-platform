<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { auth } from "$lib/auth";
  import { listEvents } from "$lib/client";

  const eventsQuery = createQuery(() => ({
    queryKey: ["events", $auth.accessToken],
    queryFn: () => listEvents($auth.accessToken),
    enabled: $auth.ready
  }));

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
</script>

<section class="page-head">
  <div>
    <p class="muted">Upcoming readings, workshops, salons, and open mics</p>
    <h1>Find your next room.</h1>
  </div>
  <a class="button-link" href="/create">Host an event</a>
</section>

{#if eventsQuery.isLoading}
  <p>Loading events...</p>
{:else if eventsQuery.isError}
  <p class="error">Could not load events.</p>
{:else if eventsQuery.data?.events.length === 0}
  <article class="card">
    <h2>No events yet</h2>
    <p class="muted">Create the first poetry event and invite people in.</p>
  </article>
{:else}
  <section class="grid" aria-label="Upcoming events">
    {#each eventsQuery.data?.events ?? [] as event}
      <article class="card">
        <a href={`/events/${event.id}`}>
          <h2>{event.title}</h2>
          <p>{event.description}</p>
          <div class="meta">
            <span>{formatter.format(new Date(event.startsAt))}</span>
            <span>{event.venue}</span>
            <span>{event.attendeeCount} attending</span>
          </div>
        </a>
      </article>
    {/each}
  </section>
{/if}
