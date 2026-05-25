<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { auth } from "$lib/auth";
  import { recommendations } from "$lib/client";

  const recommendationsQuery = createQuery(() => ({
    queryKey: ["recommendations", $auth.accessToken],
    queryFn: () => recommendations($auth.accessToken),
    enabled: Boolean($auth.ready && $auth.accessToken)
  }));

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
</script>

<section class="page-head">
  <div>
    <p class="muted">Weighted by people you have shared events with</p>
    <h1>Recommended rooms.</h1>
  </div>
</section>

{#if !$auth.user}
  <article class="card">
    <h2>Log in for recommendations</h2>
    <p class="muted">Recommendations are based on your RSVP overlap with other attendees.</p>
    <a class="button-link" href="/login">Log in</a>
  </article>
{:else if recommendationsQuery.isLoading}
  <p>Finding recommendations...</p>
{:else if recommendationsQuery.isError}
  <p class="error">Could not load recommendations.</p>
{:else if recommendationsQuery.data?.recommendations.length === 0}
  <article class="card">
    <h2>No recommendations yet</h2>
    <p class="muted">RSVP to events and overlap with other attendees to unlock recommendations.</p>
  </article>
{:else}
  <section class="grid" aria-label="Recommendations">
    {#each recommendationsQuery.data?.recommendations ?? [] as recommendation}
      <article class="card">
        <a href={`/events/${recommendation.event.id}`}>
          <h2>{recommendation.event.title}</h2>
          <p>{recommendation.event.description}</p>
          <div class="meta">
            <span>Score {recommendation.score}</span>
            <span>{recommendation.adjacentUserCount} adjacent attendees</span>
            <span>{formatter.format(new Date(recommendation.event.startsAt))}</span>
          </div>
        </a>
      </article>
    {/each}
  </section>
{/if}
