export async function getDefaultMemoryCount(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'default_conversation_memory_count')
    .maybeSingle();
  return data?.value ? Number(data.value) : 10;
}
