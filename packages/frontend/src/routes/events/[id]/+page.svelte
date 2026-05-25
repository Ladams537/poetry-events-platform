<script lang="ts">
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { page } from "$app/stores";
  import { auth } from "$lib/auth";
  import { cancelRsvp, getEvent, rsvpEvent } from "$lib/client";

  const queryClient = useQueryClient();
  const eventId = $page.params.id ?? "";
  let pending = false;
  let error = "";

  const eventQuery = createQuery(() => ({
    queryKey: ["event", eventId, $auth.accessToken],
    queryFn: () => getEvent(eventId, $auth.accessToken),
    enabled: Boolean($auth.ready && eventId)
  }));

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short"
  });

  async function toggleRsvp(): Promise<void> {
    if (!$auth.accessToken) {
      error = "Log in to RSVP.";
      return;
    }
    pending = true;
    error = "";
    try {
      if (eventQuery.data?.event.currentUserRsvped) {
        await cancelRsvp(eventId, $auth.accessToken);
      } else {
        await rsvpEvent(eventId, $auth.accessToken);
      }
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Could not update RSVP.";
    } finally {
      pending = false;
    }
  }
</script>

{#if eventQuery.isLoading}
  <p>Loading event...</p>
{:else if eventQuery.isError || !eventQuery.data}
  <p class="error">Could not load this event.</p>
{:else}
  <section class="detail">
    <div>
      <p class="muted">{formatter.format(new Date(eventQuery.data.event.startsAt))}</p>
      <h1>{eventQuery.data.event.title}</h1>
      <p class="lede">{eventQuery.data.event.description}</p>
      <div class="meta">
        <span>{eventQuery.data.event.venue}</span>
        <span>{eventQuery.data.event.attendeeCount} attending</span>
        {#if eventQuery.data.event.capacity}
          <span>Capacity {eventQuery.data.event.capacity}</span>
        {/if}
      </div>
      <div class="actions">
        <button type="button" on:click={toggleRsvp} disabled={pending}>
          {eventQuery.data.event.currentUserRsvped ? "Cancel RSVP" : "RSVP"}
        </button>
        {#if error}
          <p class="error">{error}</p>
        {/if}
      </div>
    </div>

    <aside class="card">
      <h2>Attendees</h2>
      {#if eventQuery.data.event.attendees.length === 0}
        <p class="muted">No RSVPs yet.</p>
      {:else}
        <ul>
          {#each eventQuery.data.event.attendees as attendee}
            <li>{attendee.name}</li>
          {/each}
        </ul>
      {/if}
    </aside>
  </section>
{/if}

<style>
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 340px);
    gap: 24px;
    align-items: start;
  }

  .lede {
    max-width: 820px;
    font-size: 1.15rem;
    line-height: 1.65;
  }

  .actions {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-top: 24px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  @media (max-width: 820px) {
    .detail {
      grid-template-columns: 1fr;
    }
  }
</style>
