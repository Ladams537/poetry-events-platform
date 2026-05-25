<script lang="ts">
  import { goto } from "$app/navigation";
  import { authRegisterBodySchema } from "@poetry/shared";
  import { register } from "$lib/client";
  import { setAuth } from "$lib/auth";
  import "$lib/forms";

  let name = "";
  let email = "";
  let password = "";
  let error = "";
  let pending = false;

  async function submit(): Promise<void> {
    error = "";
    pending = true;
    const parsed = authRegisterBodySchema.safeParse({ name, email, password });
    if (!parsed.success) {
      error = parsed.error.issues[0]?.message ?? "Check your details.";
      pending = false;
      return;
    }

    try {
      setAuth(await register(parsed.data));
      await goto("/");
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : "Registration failed.";
    } finally {
      pending = false;
    }
  }
</script>

<section class="page-head">
  <div>
    <p class="muted">Join the platform</p>
    <h1>Sign up.</h1>
  </div>
</section>

<form class="form" on:submit|preventDefault={submit}>
  <label>
    Name
    <input bind:value={name} autocomplete="name" required minlength="2" />
  </label>
  <label>
    Email
    <input bind:value={email} type="email" autocomplete="email" required />
  </label>
  <label>
    Password
    <input bind:value={password} type="password" autocomplete="new-password" required minlength="8" />
  </label>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button type="submit" disabled={pending}>{pending ? "Creating account..." : "Create account"}</button>
</form>
