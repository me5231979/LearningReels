"use client";

import { create } from "zustand";
import { Course, CourseProgress } from "@/types/course";

interface CourseStore {
  course: Course | null;
  progress: CourseProgress | null;
  isGenerating: boolean;
  generationStatus: string;

  setCourse: (course: Course) => void;
  setProgress: (progress: CourseProgress) => void;
  setIsGenerating: (val: boolean) => void;
  setGenerationStatus: (status: string) => void;
  completeModule: (moduleIndex: number, difficulty: number) => void;
  updateDifficulty: (moduleIndex: number, difficulty: number) => void;
  setLearnerName: (name: string) => void;
  addSkills: (skills: string[]) => void;
  reset: () => void;
  loadFromStorage: (courseId: string) => boolean;
}

function saveCourse(course: Course) {
  if (typeof window === "undefined") return;
  const courses = JSON.parse(localStorage.getItem("lp-courses") || "{}");
  courses[course.id] = course;
  localStorage.setItem("lp-courses", JSON.stringify(courses));
}

function saveProgress(progress: CourseProgress) {
  if (typeof window === "undefined") return;
  const allProgress = JSON.parse(
    localStorage.getItem("lp-progress") || "{}"
  );
  allProgress[progress.courseId] = progress;
  localStorage.setItem("lp-progress", JSON.stringify(allProgress));
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  course: null,
  progress: null,
  isGenerating: false,
  generationStatus: "",

  setCourse: (course) => {
    saveCourse(course);
    localStorage.setItem("lp-active-course", course.id);
    const progress: CourseProgress = {
      courseId: course.id,
      completedModules: [],
      moduleScores: {},
      currentModule: 0,
      skills: [],
    };
    saveProgress(progress);
    set({ course, progress });
  },

  setProgress: (progress) => {
    saveProgress(progress);
    set({ progress });
  },

  setIsGenerating: (val) => set({ isGenerating: val }),
  setGenerationStatus: (status) => set({ generationStatus: status }),

  completeModule: (moduleIndex, difficulty) => {
    const { progress, course } = get();
    if (!progress || !course) return;
    const updated: CourseProgress = {
      ...progress,
      completedModules: [...new Set([...progress.completedModules, moduleIndex])],
      moduleScores: {
        ...progress.moduleScores,
        [moduleIndex]: { difficulty, passed: true },
      },
      currentModule: Math.min(moduleIndex + 1, 5),
    };
    saveProgress(updated);
    set({ progress: updated });
  },

  updateDifficulty: (moduleIndex, difficulty) => {
    const { progress } = get();
    if (!progress) return;
    const existing = progress.moduleScores[moduleIndex] || {
      difficulty: 1,
      passed: false,
    };
    const updated: CourseProgress = {
      ...progress,
      moduleScores: {
        ...progress.moduleScores,
        [moduleIndex]: { ...existing, difficulty },
      },
    };
    saveProgress(updated);
    set({ progress: updated });
  },

  setLearnerName: (name) => {
    const { progress } = get();
    if (!progress) return;
    const updated = { ...progress, learnerName: name };
    saveProgress(updated);
    set({ progress: updated });
  },

  addSkills: (skills) => {
    const { progress } = get();
    if (!progress) return;
    const updated = {
      ...progress,
      skills: [...new Set([...progress.skills, ...skills])],
    };
    saveProgress(updated);
    set({ progress: updated });
  },

  reset: () => {
    set({
      course: null,
      progress: null,
      isGenerating: false,
      generationStatus: "",
    });
  },

  loadFromStorage: (courseId) => {
    if (typeof window === "undefined") return false;
    const courses = JSON.parse(localStorage.getItem("lp-courses") || "{}");
    const allProgress = JSON.parse(
      localStorage.getItem("lp-progress") || "{}"
    );
    const course = courses[courseId];
    const progress = allProgress[courseId];
    if (course && progress) {
      set({ course, progress });
      return true;
    }
    return false;
  },
}));
