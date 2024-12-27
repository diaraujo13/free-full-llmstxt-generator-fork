export async function mockSummary(content: string): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return first 200 characters as mock summary
  return content.slice(0, 200) + '...';
}