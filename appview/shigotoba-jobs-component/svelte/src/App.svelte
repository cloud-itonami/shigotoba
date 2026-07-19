<script lang="ts">
  import { onMount } from 'svelte';
  
  
  
  
  
  


  type Job = {
    id: string;
    source: string;
    title: string;
    'company_name': string;
    country: string;
    city: string;
    'remote_type': string;
    'employment_type': string;
    'posted_at': string;
    'source_url': string;
    skills: string[];
    'short_description': string;
  };

  type DataSourceEntry = {
    name: string;
    last_success_at?: string;
    last_error?: string;
    'fetched_count': number;
    'accepted_count': number;
  };

  type DataSourceResponse = {
    'jobs_count': number;
    last_refresh_at?: string;
    sources: DataSourceEntry[];
  };

  let q = '';
  let country = '';
  let remoteType = '';
  let postedWithinDays = 30;
  let loading = false;
  let refreshing = false;
  let totalCount = 0;
  let jobs: Job[] = [];
  let sourceStatus: DataSourceResponse | null = null;
  let error = '';
  const UNSUPPORTED_NETWORK_ERROR =
    'Unsupported: no local Connect descriptor/client is configured for job/source network calls.';

  const remoteOptions = ['', 'remote', 'hybrid', 'onsite'];

  async function search(): Promise<void> {
    loading = true;
    error = '';
    try {
      throw new Error(UNSUPPORTED_NETWORK_ERROR);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function loadSources(): Promise<void> {
    try {
      throw new Error(UNSUPPORTED_NETWORK_ERROR);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function refreshSources(): Promise<void> {
    refreshing = true;
    error = '';
    try {
      throw new Error(UNSUPPORTED_NETWORK_ERROR);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      refreshing = false;
    }
  }

  function timeLabel(value?: string): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  onMount(async () => {
    await loadSources();
    await search();
  });
</script>

<AppShell>
  {#snippet header()}
    <Header>
      {#snippet left()}
        <div class="flex flex-col gap-0.5">
          <a href="/" class="font-extrabold tracking-wide no-underline">shigotoba.etzhayyim.com</a>
          <span class="text-xs text-etzhayyim-muted">Global public jobs collection</span>
        </div>
      {/snippet}
      {#snippet right()}
        <button class="h-[34px] rounded-lg border border-etzhayyim-border bg-[color-mix(in_oklab,var(--gv2-bg-panel,#111827),white_3%)] text-etzhayyim-text px-3 font-bold cursor-pointer" onclick={refreshSources} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh Sources'}
        </button>
        <ThemeToggle size={30} />
      {/snippet}
    </Header>
  {/snippet}

  {#snippet sidebar()}
    <Sidebar>
      <AppsDirectory apps={apps} title="etzhayyim Apps" showSearch={true} />
    </Sidebar>
  {/snippet}

  <ContentArea>
    <section class="border border-etzhayyim-border rounded-[14px] bg-[color-mix(in_oklab,var(--gv2-bg-panel,#111827),black_4%)] p-4 mb-3.5">
      <h1 class="m-0 text-[clamp(22px,2.2vw,30px)]">Indeed-style global search with live public sources</h1>
      <p class="text-etzhayyim-muted mt-1 mb-3">
        {#if sourceStatus}
          {sourceStatus.jobs_count} jobs in cache · last refresh {timeLabel(sourceStatus.last_refresh_at)}
        {:else}
          Loading source status...
        {/if}
      </p>

      <div class="grid gap-2.5 grid-cols-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <input type="text" bind:value={q} placeholder="Search title, skill, company" onkeydown={(e) => e.key === 'Enter' && search()} class="h-9 rounded-lg border border-etzhayyim-border bg-[color-mix(in_oklab,var(--gv2-bg,#0f172a),white_4%)] text-etzhayyim-text px-2.5" />
        <input type="text" bind:value={country} placeholder="Country (e.g. Germany)" onkeydown={(e) => e.key === 'Enter' && search()} class="h-9 rounded-lg border border-etzhayyim-border bg-[color-mix(in_oklab,var(--gv2-bg,#0f172a),white_4%)] text-etzhayyim-text px-2.5" />
        <select bind:value={remoteType} class="h-9 rounded-lg border border-etzhayyim-border bg-[color-mix(in_oklab,var(--gv2-bg,#0f172a),white_4%)] text-etzhayyim-text px-2.5">
          {#each remoteOptions as opt}
            <option value={opt}>{opt || 'All remote types'}</option>
          {/each}
        </select>
        <select bind:value={postedWithinDays} class="h-9 rounded-lg border border-etzhayyim-border bg-[color-mix(in_oklab,var(--gv2-bg,#0f172a),white_4%)] text-etzhayyim-text px-2.5">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button class="h-9 rounded-lg border border-etzhayyim-border bg-[color-mix(in_oklab,var(--gv2-bg-panel,#111827),white_3%)] text-etzhayyim-text px-3 font-bold cursor-pointer" onclick={search} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </div>

      {#if error}
        <p class="mt-2.5 text-[#fca5a5]">{error}</p>
      {/if}
    </section>

    <section class="border border-etzhayyim-border rounded-[14px] bg-[color-mix(in_oklab,var(--gv2-bg-panel,#111827),black_4%)] p-4 mb-3.5">
      <h2 class="m-0 mb-2.5 text-xl">Source health</h2>
      <div class="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        {#if sourceStatus?.sources?.length}
          {#each sourceStatus.sources as s}
            <article class="grid gap-1 border border-etzhayyim-border rounded-[10px] p-2.5">
              <strong>{s.name}</strong>
              <span>accepted {s.accepted_count} / fetched {s.fetched_count}</span>
              <span>last success: {timeLabel(s.last_success_at)}</span>
              {#if s.last_error}
                <span class="text-[#fca5a5]">last error: {s.last_error}</span>
              {/if}
            </article>
          {/each}
        {:else}
          <span>No source status yet.</span>
        {/if}
      </div>
    </section>

    <section class="border border-etzhayyim-border rounded-[14px] bg-[color-mix(in_oklab,var(--gv2-bg-panel,#111827),black_4%)] p-4 mb-3.5">
      <h2 class="m-0 mb-2.5 text-xl">Results ({totalCount})</h2>
      <div class="grid gap-3 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {#if jobs.length === 0 && !loading}
          <p>No jobs found.</p>
        {/if}
        {#each jobs as job}
          <article class="border border-etzhayyim-border rounded-xl p-3 grid gap-2 bg-[color-mix(in_oklab,var(--gv2-bg,#0f172a),white_2%)]">
            <header class="flex items-baseline justify-between gap-2.5">
              <h3 class="m-0 text-base leading-snug">{job.title}</h3>
              <span class="text-[11px] uppercase tracking-wider text-etzhayyim-muted">{job.source}</span>
            </header>
            <p class="m-0 text-[13px] text-etzhayyim-secondary">{job.company_name} · {job.country}{job.city ? `, ${job.city}` : ''}</p>
            <p class="m-0 text-[13px] text-etzhayyim-secondary">{job.remote_type} · {job.employment_type}</p>
            <p class="m-0 text-[13px] text-etzhayyim-secondary">{job.short_description}</p>
            <div class="flex flex-wrap gap-1.5">
              {#each job.skills?.slice(0, 5) ?? [] as skill}
                <span class="text-[11px] border border-etzhayyim-border rounded-full px-2 py-0.5">{skill}</span>
              {/each}
            </div>
            <footer class="flex items-center justify-between gap-2.5 text-xs text-etzhayyim-muted">
              <span>{timeLabel(job.posted_at)}</span>
              <a href={job.source_url} target="_blank" rel="noreferrer">Open source</a>
            </footer>
          </article>
        {/each}
      </div>
    </section>
  </ContentArea>

  {#snippet footer()}
    <Footer>
      <small>Shigotoba uses public job APIs and continuously refreshes the catalog.</small>
    </Footer>
  {/snippet}
</AppShell>
