export const getProductEmoji = (name?: string) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('bánh')) return '🥖';
    if (n.includes('kẹo')) return '🍬';
    if (n.includes('sữa')) return '🥛';
    if (n.includes('nước') || n.includes('sting') || n.includes('pepsi')) return '🥤';
    if (n.includes('rau')) return '🥬';
    if (n.includes('thịt')) return '🥩';
    if (n.includes('cá')) return '🐟';
    return '📦';
};
