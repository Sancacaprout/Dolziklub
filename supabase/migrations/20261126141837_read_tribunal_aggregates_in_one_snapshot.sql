-- Read progress and anonymous rankings from the same statement snapshot.
alter function public.get_tribunal_results(bigint) stable;
alter function public.get_tribunal_results_v2(bigint) stable;
alter function public.get_tribunal_results_v3(bigint) stable;
