import { type SearchHistory, type InsertSearchHistory, type Favorite, type InsertFavorite, type ProcessResult } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Search History
  getSearchHistory(): Promise<SearchHistory[]>;
  addSearchHistory(search: InsertSearchHistory): Promise<SearchHistory>;
  
  // Favorites
  getFavorites(): Promise<Favorite[]>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(processNumber: string): Promise<boolean>;
  getFavoriteByProcessNumber(processNumber: string): Promise<Favorite | undefined>;
}

export class MemStorage implements IStorage {
  private searchHistory: Map<string, SearchHistory>;
  private favorites: Map<string, Favorite>;

  constructor() {
    this.searchHistory = new Map();
    this.favorites = new Map();
  }

  async getSearchHistory(): Promise<SearchHistory[]> {
    return Array.from(this.searchHistory.values())
      .sort((a, b) => new Date(b.searchedAt!).getTime() - new Date(a.searchedAt!).getTime())
      .slice(0, 10); // Return last 10 searches
  }

  async addSearchHistory(insertSearch: InsertSearchHistory): Promise<SearchHistory> {
    const id = randomUUID();
    const search: SearchHistory = {
      ...insertSearch,
      id,
      searchedAt: new Date(),
      resultData: insertSearch.resultData || null,
    };
    this.searchHistory.set(id, search);
    return search;
  }

  async getFavorites(): Promise<Favorite[]> {
    return Array.from(this.favorites.values())
      .sort((a, b) => new Date(b.addedAt!).getTime() - new Date(a.addedAt!).getTime());
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const id = randomUUID();
    const favorite: Favorite = {
      ...insertFavorite,
      id,
      addedAt: new Date(),
    };
    this.favorites.set(insertFavorite.processNumber, favorite);
    return favorite;
  }

  async removeFavorite(processNumber: string): Promise<boolean> {
    return this.favorites.delete(processNumber);
  }

  async getFavoriteByProcessNumber(processNumber: string): Promise<Favorite | undefined> {
    return this.favorites.get(processNumber);
  }
}

export const storage = new MemStorage();
