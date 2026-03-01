import type { Request, Response } from 'express';

export const getProfiles = async (req: Request, res: Response) => {
    try {
        // Mock data for Buddy discovery
        const profiles = [
            { id: '1', name: 'Alice', bio: 'Love hiking and music', status: 'online', tags: ['wellness', 'music'] },
            { id: '2', name: 'Bob', bio: 'Yoga enthusiast', status: 'away', tags: ['yoga', 'meditation'] },
            { id: '3', name: 'Charlie', bio: 'Deep conversations only', status: 'online', tags: ['philosophy', 'books'] },
        ];
        res.status(200).json(profiles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profiles', error });
    }
};

export const getProfileById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        // Mock single profile fetch
        const profile = { id, name: `User ${id}`, bio: 'Detailed bio here...', status: 'online', tags: ['tag1', 'tag2'] };
        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const updateData = req.body;
        // TODO: Update in database
        res.status(200).json({ message: 'Profile updated successfully', data: updateData });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error });
    }
};
