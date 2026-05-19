# Security Specification - Enterprise Task & Communication Hub

## Data Invariants
1. A Folder must belong to an existing Organization.
2. A Task must belong to a valid Folder and Organization.
3. A TaskLink must reference a valid Task and Folder.
4. Messages are strictly bound to an Organization and cannot be modified or deleted by users after sending (for audit/integrity).
5. Progress on a Task is read-only for the client and updated via the logic that manages sub-tasks (though in this implementation, we will allow client updates during development but ideally it should be derived). *Correction: I will allow update but validate range.*

## The Dirty Dozen Payloads

1. **Identity Theft (Create Org):** Try to create an organization with someone else's `managerId`.
2. **Path Injection:** Task ID containing `../admin/secrets`.
3. **Shadow Field:** Adding `isVerified: true` to a UserProfile.
4. **Relationship Breaking:** Creating a Folder with an `organizationId` that does not exist.
5. **PII Leak:** Reading another user's `UserProfile` private data (email).
6. **Task Hijacking:** Updating a Task in an Organization you don't belong to.
7. **Progress Spoofing:** Setting a Task's `progress` to `150`.
8. **Message Spoofing:** Sending a message as another user.
9. **Link Poisoning:** Attaching a 1MB payload as a Link Label.
10. **Folder Deletion:** Attempting to delete a folder without being the Manager.
11. **Subtask Orphanage:** Creating a subtask for a task that doesn't exist.
12. **System Field Update:** Modifying the `createdAt` timestamp.

## Test Runner (Draft Logic)
The `firestore.rules.test.ts` will verify these scenarios by attempting the malicious writes and expecting `PERMISSION_DENIED`.
