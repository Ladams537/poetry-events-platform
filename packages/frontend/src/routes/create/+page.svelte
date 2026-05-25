<script lang="ts">
  import { goto } from "$app/navigation";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { eventCreateBodySchema } from "@poetry/shared";
  import { auth } from "$lib/auth";
  import { createEvent } from "$lib/client";
  import "$lib/forms";

  const queryClient = useQueryClient();
  let title = "";
  let description = "";
  let venue = "";
  let startsAt = "";
  let capacity = 60;
  let error = "";
  let pending = false;

  async function submit(): Promise<void> {
    if (!$auth.accessToken) {
      error = "Log in to create an event.";
      return;
    }
    pending = true;
    error = "";
    const parsed = eventCreateBodySchema.safeParse({
      title,
      description,
      venue,
      startsAt: new Date(startsAt).toISOString(),
      capacity
    });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? "Check the event details.";
      pending = false;
      return;
    }

    try {
      const response = await createEvent(parsed.data, $auth.accessToken);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["hosted-events"] });
      await goto(`/events/${response.event.id}`);
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Could not create event.";
    } finally {
      pending = false;
    }
  }
</script>

<section class="page-head">
  <div>
    <p class="muted">Host a reading, workshop, salon, or open mic</p>
    <h1>Create an event.</h1>
  </div>
</section>

<form class="form" on:submit|preventDefault={submit}>
  <label>
    Title
    <input bind:value={title} required minlength="3" maxlength="120" />
  </label>
  <label>
    Description
    <textarea bind:value={description} required minlength="10" maxlength="2000"></textarea>
  </label>
  <label>
    Venue
    <input bind:value={venue} required minlength="2" maxlength="160" />
  </label>
  <label>
    Starts at
    <input bind:value={startsAt} type="datetime-local" required />
  </label>
  <label>
    Capacity
    <input bind:value={capacity} type="number" min="1" max="500" />
  </label>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button type="submit" disabled={pending}>{pending ? "Creating..." : "Create event"}</button>
</form>
