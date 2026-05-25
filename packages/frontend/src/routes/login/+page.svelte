<script lang="ts">
  import { goto } from "$app/navigation";
  import { authLoginBodySchema } from "@poetry/shared";
  import { login } from "$lib/client";
  import { setAuth } from "$lib/auth";
  import "$lib/forms";

  let email = "";
  let password = "";
  let error = "";
  let pending = false;

  async function submit(): Promise<void> {
    error = "";
    pending = true;
    const parsed = authLoginBodySchema.safeParse({ email, password });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? "Check your details.";
      pending = false;
      return;
    }

    try {
      setAuth(await login(parsed.data));
      await goto("/");
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Login failed.";
    } finally {
      pending = false;
    }
  }
</script>

<section class="page-head">
  <div>
    <p class="muted">Welcome back</p>
    <h1>Log in.</h1>
  </div>
</section>

<form class="form" on:submit|preventDefault={submit}>
  <label>
    Email
    <input bind:value={email} type="email" autocomplete="email" required />
  </label>
  <label>
    Password
    <input bind:value={password} type="password" autocomplete="current-password" required minlength="8" />
  </label>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button type="submit" disabled={pending}>{pending ? "Logging in..." : "Log in"}</button>
</form>
