const PAGE_FIELDS = "id, filename, title, content_md, created_at, updated_at";
const PAGE_LIST_FIELDS = "id, filename, title, updated_at";

export function getPageTitle(content) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim());

  if (!firstLine) {
    return "Untitled";
  }

  const title = firstLine
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();

  return title.slice(0, 160) || "Untitled";
}

export function sortPages(pages) {
  return [...pages].sort((firstPage, secondPage) => {
    return new Date(secondPage.updated_at).getTime() - new Date(firstPage.updated_at).getTime();
  });
}

export async function listJournalPages(supabase, userId) {
  const { data, error } = await supabase
    .from("journal_pages")
    .select(PAGE_LIST_FIELDS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getJournalPage(supabase, userId, pageId) {
  const { data, error } = await supabase
    .from("journal_pages")
    .select(PAGE_FIELDS)
    .eq("user_id", userId)
    .eq("id", pageId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createJournalPage(supabase, userId, pageId) {
  const { data, error } = await supabase
    .from("journal_pages")
    .insert({
      id: pageId,
      user_id: userId,
      filename: `page-${pageId}.md`,
      title: "Untitled",
      content_md: ""
    })
    .select(PAGE_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateJournalPage(supabase, userId, pageId, content) {
  const { data, error } = await supabase
    .from("journal_pages")
    .update({
      content_md: content,
      title: getPageTitle(content)
    })
    .eq("user_id", userId)
    .eq("id", pageId)
    .select(PAGE_LIST_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
