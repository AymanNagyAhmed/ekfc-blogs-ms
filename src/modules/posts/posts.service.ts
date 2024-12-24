import { Inject, Injectable, Logger } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions/resource-not-found.exception';
import { InvalidInputException } from '@/common/exceptions/invalid-input.exception';
import { UnexpectedErrorException } from '@/common/exceptions/unexpected-error.exception';
import { CreatePostDto } from '@/modules/posts/dto/create-post.dto';
import { UpdatePostDto } from '@/modules/posts/dto/update-post.dto';
import { ClientProxy } from '@nestjs/microservices';
import { BLOGS_SERVICE } from '@/common/constants/services';
import { Post } from '@/modules/posts/schemas/post.schema';
import { PostsRepository } from '@/modules/posts/posts.repository';
import { lastValueFrom } from 'rxjs';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly postsRepository: PostsRepository,
    @Inject(BLOGS_SERVICE) private blogsClient: ClientProxy
  ) {}

  /**
   * find all posts
   */
  async findAll(): Promise<Post[]> {
    return await this.postsRepository.find({});
  }

  /**
   * Creates a new post 
   * @param createPostDto Post creation data
   * @returns Newly created post object
   * @throws InvalidInputException if email already exists
   */
  async createPost(createPostDto: CreatePostDto): Promise<Post> {
    try {
      const post = await this.postsRepository.create(createPostDto);
      await lastValueFrom(this.blogsClient.emit('post_created', post));
      return post;
    } catch (error) {
      console.error('Error creating post:', error);
      throw new UnexpectedErrorException('Error creating post');
    }
  }

  /**
   * Retrieves a post by their ID
   * @param id Post's unique identifier
   * @returns Post object
   * @throws ResourceNotFoundException if post not found
   */
  async findPostById(id: string): Promise<Post> {
    try {
      const post = await this.postsRepository.findOne({ _id: id });
      return post;
    } catch (error) {
      console.error('Error finding post:', error);
      throw error;
    }
  }

  /**
   * Updates post information
   * @param id Post's unique identifier
   * @param updatePostDto Data to update
   * @returns Updated post object
   * @throws ResourceNotFoundException if post not found
   */
  async updatePost(id: string, updatePostDto: UpdatePostDto): Promise<Post> {
    try {
      // First check if post exists
      const existingPost = await this.postsRepository.findOne({ _id: id });
      
      if (!existingPost) {
        throw new ResourceNotFoundException('Post not found');
      }

      // Update the post using findOneAndUpdate from AbstractRepository
      const updatedPost = await this.postsRepository.findOneAndUpdate(
        { _id: id },
        { $set: updatePostDto }
      );

      // Emit post updated event
      await lastValueFrom(this.blogsClient.emit('post_updated', updatedPost));
      
      return updatedPost;
    } catch (error) {
      console.error('Error updating post:', error);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new UnexpectedErrorException('Error updating post');
    }
  }

  /**
   * Deletes a post account
   * @param id Post's unique identifier
   * @throws ResourceNotFoundException if post not found
   */
  async deletePost(id: string): Promise<void> {
    try {
      // First check if post exists
      const post = await this.postsRepository.findOne({ _id: id });
      
      if (!post) {
        throw new ResourceNotFoundException('Post');
      }

      await this.postsRepository.deleteOne({ _id: id });
      
      // Emit post deleted event only after successful deletion
      await lastValueFrom(this.blogsClient.emit('post_deleted', { id }));
    } catch (error) {
      this.logger.error('Error deleting post:', error);
      
      if (error instanceof ResourceNotFoundException) {
        throw new ResourceNotFoundException('Post');
      }
      
      throw new UnexpectedErrorException(
        'Error deleting post',
        error instanceof Error ? error : undefined
      );
    }
  }

  async handlePostCreated(post: Post): Promise<void> {
    this.logger.log(`Handling post created event for post: ${post._id}`);
    // Add any additional logic needed when a post is created
  }

  async handlePostUpdated(post: Post): Promise<void> {
    this.logger.log(`Handling post updated event for post: ${post._id}`);
    // Add any additional logic needed when a post is updated
  }

  async handlePostDeleted(postId: string): Promise<void> {
    this.logger.log(`Handling post deleted event for post: ${postId}`);
    // Add any additional logic needed when a post is deleted
  }
}
